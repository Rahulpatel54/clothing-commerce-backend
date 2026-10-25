'use strict';

const logger = require('../../../config/logger');

class WhatsAppChannel {
  async send({ recipient, title, body, metadata = {} }) {
    logger.info({ recipient, title, metadata }, '[WhatsAppChannel] Sending WhatsApp message');
    // Pluggable provider logic (e.g. Meta Cloud API, Twilio WhatsApp) can be hooked here.
    return {
      success: true,
      provider: 'mock-whatsapp',
      messageId: `wa-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    };
  }
}

module.exports = new WhatsAppChannel();
