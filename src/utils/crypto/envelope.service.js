'use strict';

const crypto = require('crypto');
const { getKmsProvider } = require('./kms');
const logger = require('../../config/logger');

class EnvelopeEncryptionService {
  constructor() {
    this.keyCache = new Map(); // version (int) -> Buffer (decrypted DEK)
    this.activeVersion = null;
    this.kms = getKmsProvider();
    this.initPromise = null;
  }

  getModels() {
    return require('../../models');
  }

  /**
   * Ensure active DEK is loaded in cache, bootstrapping version 1 if empty.
   */
  async ensureInitialized() {
    if (this.activeVersion && this.keyCache.has(this.activeVersion)) {
      return;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const { EncryptionKey } = this.getModels();
        let activeKey = await EncryptionKey.findOne({
          where: { isActive: true },
          order: [['keyVersion', 'DESC']],
        });

        if (!activeKey) {
          logger.info('[EnvelopeEncryption] No active encryption key found. Generating Version 1 DEK');
          const rawDek = crypto.randomBytes(32);
          const encryptedDek = await this.kms.encryptDek(rawDek);

          activeKey = await EncryptionKey.create({
            keyVersion: 1,
            encryptedDek,
            algorithm: 'aes-256-gcm',
            isActive: true,
          });

          this.keyCache.set(1, rawDek);
          this.activeVersion = 1;
        } else {
          const decryptedDek = await this.kms.decryptDek(activeKey.encryptedDek);
          this.keyCache.set(activeKey.keyVersion, decryptedDek);
          this.activeVersion = activeKey.keyVersion;
        }
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Retrieve decrypted DEK for a specific version, caching it.
   */
  async getDekForVersion(version) {
    if (this.keyCache.has(version)) {
      return this.keyCache.get(version);
    }

    const { EncryptionKey } = this.getModels();
    const keyRecord = await EncryptionKey.findOne({ where: { keyVersion: version } });
    if (!keyRecord) {
      throw new Error(`Encryption key for version ${version} not found in database`);
    }

    const decryptedDek = await this.kms.decryptDek(keyRecord.encryptedDek);
    this.keyCache.set(version, decryptedDek);
    return decryptedDek;
  }

  /**
   * Encrypt plaintext using the active versioned DEK.
   * Ciphertext format: v{version}:{iv}:{authTag}:{ciphertext}
   */
  async encrypt(plaintext) {
    if (plaintext === null || plaintext === undefined) return plaintext;
    await this.ensureInitialized();

    const dek = this.keyCache.get(this.activeVersion);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);

    const inputBuf = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
    const encrypted = Buffer.concat([cipher.update(inputBuf), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `v${this.activeVersion}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt ciphertext encrypted with any valid key version.
   */
  async decrypt(ciphertext) {
    if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;

    const match = ciphertext.match(/^v(\d+):([0-9a-fA-F]+):([0-9a-fA-F]+):([0-9a-fA-F]+)$/);
    if (!match) {
      // Return as-is if unencrypted legacy text
      return ciphertext;
    }

    const version = parseInt(match[1], 10);
    const iv = Buffer.from(match[2], 'hex');
    const authTag = Buffer.from(match[3], 'hex');
    const encryptedData = Buffer.from(match[4], 'hex');

    const dek = await this.getDekForVersion(version);
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuf = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decryptedBuf.toString('utf8');
  }

  /**
   * Rotate DEK to a new version.
   */
  async rotateKey() {
    await this.ensureInitialized();
    const { EncryptionKey, sequelize } = this.getModels();

    const latest = await EncryptionKey.findOne({ order: [['keyVersion', 'DESC']] });
    const nextVersion = (latest?.keyVersion || 0) + 1;

    const newRawDek = crypto.randomBytes(32);
    const encryptedDek = await this.kms.encryptDek(newRawDek);

    await sequelize.transaction(async (t) => {
      await EncryptionKey.update(
        { isActive: false, retiredAt: new Date() },
        { where: { isActive: true }, transaction: t }
      );

      await EncryptionKey.create(
        {
          keyVersion: nextVersion,
          encryptedDek,
          algorithm: 'aes-256-gcm',
          isActive: true,
        },
        { transaction: t }
      );
    });

    this.keyCache.set(nextVersion, newRawDek);
    this.activeVersion = nextVersion;
    logger.info({ newVersion: nextVersion }, '[EnvelopeEncryption] Rotated to new DEK version');

    return { newVersion: nextVersion };
  }

  isEncryptedWithActiveVersion(ciphertext) {
    if (!ciphertext || typeof ciphertext !== 'string') return false;
    return ciphertext.startsWith(`v${this.activeVersion}:`);
  }
}

const envelopeService = new EnvelopeEncryptionService();
module.exports = envelopeService;
