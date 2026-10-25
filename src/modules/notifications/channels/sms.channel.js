'use strict';

const logger = require('../../../config/logger');

class SmsChannel {
  async send({ recipient, title, body, metadata = {} }) {
    logger.info({ recipient, title, metadata }, '[SmsChannel] Sending SMS');
    // Pluggable provider logic (e.g. Twilio, MSG91, SNS) can be hooked here.
    return {
      success: true,
      provider: 'mock-sms',
      messageId: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    };
  }
}

module.exports = new SmsChannel();
