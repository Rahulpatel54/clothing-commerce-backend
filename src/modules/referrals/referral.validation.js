'use strict';

const Joi = require('joi');

module.exports = {
  validate: { body: Joi.object({ refereeUserId: Joi.string().uuid().required(), fraudSignals: Joi.object().unknown(true) }) },
};
