'use strict';

const logger = require('../../../config/logger');

class EmailChannel {
  async send({ recipient, title, body, metadata = {} }) {
    logger.info({ recipient, title, metadata }, '[EmailChannel] Sending email');
    // Pluggable provider logic (e.g. SendGrid, SES, Resend) can be hooked here.
    return {
      success: true,
      provider: 'mock-email',
      messageId: `email-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    };
  }
}

module.exports = new EmailChannel();
