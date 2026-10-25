'use strict';

const crypto = require('crypto');
const { LocalKmsProvider } = require('../src/utils/crypto/kms');
const envelopeService = require('../src/utils/crypto/envelope.service');
const reencryptionWorker = require('../src/jobs/reencryption.worker');
const eventBus = require('../src/modules/notifications/event.bus');

describe('Envelope Encryption & Versioned Key Architecture', () => {
  describe('LocalKmsProvider', () => {
    it('encrypts and decrypts a raw DEK buffer using master KEK', async () => {
      const kms = new LocalKmsProvider('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210');
      const rawDek = crypto.randomBytes(32);

      const encryptedCiphertext = await kms.encryptDek(rawDek);
      expect(encryptedCiphertext).toContain(':');
      expect(encryptedCiphertext.split(':').length).toBe(3);

      const decryptedDek = await kms.decryptDek(encryptedCiphertext);
      expect(Buffer.compare(rawDek, decryptedDek)).toBe(0);
    });
  });

  describe('EnvelopeEncryptionService', () => {
    let mockKeysTable;
    let mockEncryptionKeyModel;
    let mockSequelize;

    beforeEach(() => {
      mockKeysTable = [];
      envelopeService.keyCache.clear();
      envelopeService.activeVersion = null;

      mockEncryptionKeyModel = {
        findOne: jest.fn().mockImplementation(async ({ where, order }) => {
          if (where?.isActive) {
            return mockKeysTable.find((k) => k.isActive) || null;
          }
          if (where?.keyVersion !== undefined) {
            return mockKeysTable.find((k) => k.keyVersion === where.keyVersion) || null;
          }
          if (order) {
            const sorted = [...mockKeysTable].sort((a, b) => b.keyVersion - a.keyVersion);
            return sorted[0] || null;
          }
          return null;
        }),
        create: jest.fn().mockImplementation(async (record) => {
          const entry = { ...record };
          mockKeysTable.push(entry);
          return entry;
        }),
        update: jest.fn().mockImplementation(async (updates, { where }) => {
          let count = 0;
          mockKeysTable.forEach((k) => {
            if (where?.isActive && k.isActive) {
              Object.assign(k, updates);
              count++;
            }
          });
          return [count];
        }),
      };

      mockSequelize = {
        transaction: jest.fn().mockImplementation(async (fn) => fn('mock-tx')),
      };

      jest.spyOn(envelopeService, 'getModels').mockReturnValue({
        EncryptionKey: mockEncryptionKeyModel,
        sequelize: mockSequelize,
      });
    });

    it('bootstraps version 1 DEK and encrypts/decrypts plaintext', async () => {
      const plaintext = 'TOTP_SECRET_JBSWY3DPEHPK3PXP';

      const ciphertext = await envelopeService.encrypt(plaintext);
      expect(ciphertext).toMatch(/^v1:[0-9a-fA-F]+:[0-9a-fA-F]+:[0-9a-fA-F]+$/);

      const decrypted = await envelopeService.decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
      expect(envelopeService.activeVersion).toBe(1);
    });

    it('rotates to version 2 and decrypts both v1 and v2 records', async () => {
      const secretV1 = 'LEGACY_SECRET_VERSION_1';
      const ciphertextV1 = await envelopeService.encrypt(secretV1);
      expect(ciphertextV1.startsWith('v1:')).toBe(true);

      // Rotate key to version 2
      const rotation = await envelopeService.rotateKey();
      expect(rotation.newVersion).toBe(2);
      expect(envelopeService.activeVersion).toBe(2);

      // Encrypt with version 2
      const secretV2 = 'NEW_SECRET_VERSION_2';
      const ciphertextV2 = await envelopeService.encrypt(secretV2);
      expect(ciphertextV2.startsWith('v2:')).toBe(true);

      // Both ciphertexts must decrypt correctly
      expect(await envelopeService.decrypt(ciphertextV1)).toBe(secretV1);
      expect(await envelopeService.decrypt(ciphertextV2)).toBe(secretV2);
    });
  });

  describe('ReEncryptionWorker', () => {
    it('migrates legacy v1 records to active v2 key version with live progress updates', async () => {
      // Setup v1 and v2 keys
      envelopeService.keyCache.clear();
      envelopeService.activeVersion = 2;

      const rawDekV1 = crypto.randomBytes(32);
      const rawDekV2 = crypto.randomBytes(32);
      envelopeService.keyCache.set(1, rawDekV1);
      envelopeService.keyCache.set(2, rawDekV2);

      const emitSpy = jest.spyOn(eventBus, 'emit');

      // Create a record encrypted under v1
      const iv1 = crypto.randomBytes(12);
      const cipher1 = crypto.createCipheriv('aes-256-gcm', rawDekV1, iv1);
      const enc1 = Buffer.concat([cipher1.update(Buffer.from('mfa-secret-data')), cipher1.final()]);
      const tag1 = cipher1.getAuthTag();
      const legacyCiphertext = `v1:${iv1.toString('hex')}:${tag1.toString('hex')}:${enc1.toString('hex')}`;

      const mockRow = {
        id: 'user-uuid-1',
        mfaSecretEncrypted: legacyCiphertext,
        update: jest.fn().mockImplementation(async (vals) => Object.assign(mockRow, vals)),
      };

      const mockUserModel = {
        count: jest.fn().mockResolvedValue(1),
        findAll: jest
          .fn()
          .mockResolvedValueOnce([mockRow]) // 1st batch returns the row
          .mockResolvedValueOnce([]), // 2nd batch returns empty
      };

      const mockSequelize = {
        transaction: jest.fn().mockImplementation(async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } })),
      };

      jest.spyOn(reencryptionWorker, 'getModels').mockReturnValue({
        User: mockUserModel,
        sequelize: mockSequelize,
      });

      const result = await reencryptionWorker.reencryptColumn({
        modelName: 'User',
        columnName: 'mfaSecretEncrypted',
        batchSize: 10,
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockRow.update).toHaveBeenCalled();
      expect(mockRow.mfaSecretEncrypted.startsWith('v2:')).toBe(true);

      // Verify decrypted content under v2
      const decrypted = await envelopeService.decrypt(mockRow.mfaSecretEncrypted);
      expect(decrypted).toBe('mfa-secret-data');

      // Verify progress emitted
      expect(emitSpy).toHaveBeenCalledWith('KMS_ROTATION_PROGRESS', expect.objectContaining({
        status: 'COMPLETED',
        processed: 1,
      }));
    });
  });
});
