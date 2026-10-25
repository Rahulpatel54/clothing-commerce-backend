'use strict';

const { Op } = require('sequelize');
const envelopeService = require('../utils/crypto/envelope.service');
const eventBus = require('../modules/notifications/event.bus');
const logger = require('../config/logger');
const config = require('../config');

class ReEncryptionWorker {
  constructor() {
    this.isReencrypting = false;
  }

  getModels() {
    return require('../models');
  }

  getRedisClient() {
    // Optional Redis integration
    try {
      if (config.redis?.enabled) {
        const redisModule = require('../config/redis');
        return redisModule?.client || null;
      }
    } catch (e) {
      // Redis optional
    }
    return null;
  }

  async publishProgress(progress) {
    logger.info(progress, '[ReEncryptionWorker] Progress update');
    eventBus.emit('KMS_ROTATION_PROGRESS', progress);

    const redis = this.getRedisClient();
    if (redis && typeof redis.publish === 'function') {
      try {
        await redis.publish('kms:rotation:progress', JSON.stringify(progress));
        if (typeof redis.set === 'function') {
          await redis.set('kms:rotation:status', JSON.stringify(progress));
        }
      } catch (err) {
        logger.warn({ err }, '[ReEncryptionWorker] Failed publishing progress to Redis');
      }
    }
  }

  /**
   * Re-encrypts all records in a model and column to the latest active DEK version.
   * Fully idempotent, transactional, and error-isolated.
   */
  async reencryptColumn({ modelName = 'User', columnName = 'mfaSecretEncrypted', batchSize = 50 } = {}) {
    if (this.isReencrypting) {
      throw new Error('Re-encryption worker is already in progress');
    }

    this.isReencrypting = true;
    await envelopeService.ensureInitialized();
    const activeVersion = envelopeService.activeVersion;

    const models = this.getModels();
    const Model = models[modelName];
    const sequelize = models.sequelize;

    if (!Model) {
      this.isReencrypting = false;
      throw new Error(`Model ${modelName} not found`);
    }

    const versionPrefix = `v${activeVersion}:%`;

    try {
      // Count total remaining to be re-encrypted
      const totalRemaining = await Model.count({
        where: {
          [columnName]: {
            [Op.and]: [
              { [Op.ne]: null },
              { [Op.notLike]: versionPrefix },
            ],
          },
        },
      });

      let processedCount = 0;
      let failureCount = 0;

      await this.publishProgress({
        status: 'STARTED',
        model: modelName,
        column: columnName,
        activeVersion,
        total: totalRemaining,
        processed: 0,
        failed: 0,
        percentage: 0,
      });

      let hasMore = totalRemaining > 0;

      while (hasMore) {
        // Query next batch inside transaction
        let batchItems = [];

        await sequelize.transaction(async (tx) => {
          batchItems = await Model.findAll({
            where: {
              [columnName]: {
                [Op.and]: [
                  { [Op.ne]: null },
                  { [Op.notLike]: versionPrefix },
                ],
              },
            },
            limit: batchSize,
            transaction: tx,
            lock: tx.LOCK.UPDATE,
          });

          if (batchItems.length === 0) {
            hasMore = false;
            return;
          }

          for (const item of batchItems) {
            const rawCiphertext = item[columnName];
            try {
              // Decrypt under legacy key and re-encrypt under active key
              const decrypted = await envelopeService.decrypt(rawCiphertext);
              const reencrypted = await envelopeService.encrypt(decrypted);

              await item.update({ [columnName]: reencrypted }, { transaction: tx });
              processedCount++;
            } catch (itemErr) {
              logger.error({ err: itemErr, itemId: item.id }, '[ReEncryptionWorker] Failed to re-encrypt item');
              failureCount++;
            }
          }
        });

        const progressPercent = totalRemaining > 0 ? Math.min(100, Math.round((processedCount / totalRemaining) * 100)) : 100;

        await this.publishProgress({
          status: hasMore ? 'IN_PROGRESS' : 'COMPLETED',
          model: modelName,
          column: columnName,
          activeVersion,
          total: totalRemaining,
          processed: processedCount,
          failed: failureCount,
          percentage: progressPercent,
        });

        if (batchItems.length < batchSize) {
          hasMore = false;
        }
      }

      await this.publishProgress({
        status: 'COMPLETED',
        model: modelName,
        column: columnName,
        activeVersion,
        total: totalRemaining,
        processed: processedCount,
        failed: failureCount,
        percentage: 100,
      });

      return {
        status: 'COMPLETED',
        total: totalRemaining,
        processed: processedCount,
        failed: failureCount,
      };
    } finally {
      this.isReencrypting = false;
    }
  }
}

module.exports = new ReEncryptionWorker();
