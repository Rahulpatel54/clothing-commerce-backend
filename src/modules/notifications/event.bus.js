'use strict';

const EventEmitter = require('events');
const logger = require('../../config/logger');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitAsync(eventName, payload) {
    logger.debug({ eventName }, '[EventBus] Emitting domain event');
    const listeners = this.rawListeners(eventName);
    if (!listeners || listeners.length === 0) return Promise.resolve([]);

    return Promise.allSettled(
      listeners.map(async (fn) => {
        try {
          return await fn(payload);
        } catch (err) {
          logger.error({ err, eventName }, '[EventBus] Listener execution failed');
          throw err;
        }
      })
    );
  }
}

const eventBus = new EventBus();
module.exports = eventBus;
