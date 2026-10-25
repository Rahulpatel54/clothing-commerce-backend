'use strict';

/**
 * Base abstract class for KMS providers.
 * Compatible with Local KEK, HashiCorp Vault, AWS KMS, and Google Cloud KMS.
 */
class KmsProvider {
  /**
   * Encrypt a Data Encryption Key (DEK) buffer using the Key Encryption Key (KEK).
   * @param {Buffer} plaintextBuffer
   * @returns {Promise<string>} Encrypted DEK ciphertext (hex or base64)
   */
  async encryptDek(plaintextBuffer) {
    throw new Error('encryptDek() must be implemented by KMS provider');
  }

  /**
   * Decrypt an encrypted DEK ciphertext back to raw Buffer using the KEK.
   * @param {string} encryptedCiphertext
   * @returns {Promise<Buffer>} Raw DEK Buffer
   */
  async decryptDek(encryptedCiphertext) {
    throw new Error('decryptDek() must be implemented by KMS provider');
  }
}

module.exports = KmsProvider;
