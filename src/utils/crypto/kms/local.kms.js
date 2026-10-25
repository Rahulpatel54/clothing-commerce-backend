'use strict';

const crypto = require('crypto');
const KmsProvider = require('./kms.interface');
const config = require('../../../config');

class LocalKmsProvider extends KmsProvider {
  constructor(kekHex = null) {
    super();
    const rawKey = kekHex || config.security?.masterKek || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    // Ensure 32 bytes (256 bits)
    this.kek = crypto.createHash('sha256').update(String(rawKey)).digest();
  }

  async encryptDek(plaintextBuffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.kek, iv);
    const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  async decryptDek(encryptedCiphertext) {
    const parts = encryptedCiphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted DEK format. Expected iv:tag:ciphertext');
    }

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}

module.exports = LocalKmsProvider;
