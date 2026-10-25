'use strict';

const logger = require('../../../config/logger');

class PushChannel {
  async send({ recipient, title, body, metadata = {} }) {
    logger.info({ recipient, title, metadata }, '[PushChannel] Sending Push Notification');
    // Pluggable provider logic (e.g. Firebase Cloud Messaging, OneSignal, Apple APNs) can be hooked here.
    return {
      success: true,
      provider: 'mock-push',
      messageId: `push-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    };
  }
}

module.exports = new PushChannel();
