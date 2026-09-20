'use strict';

const config = require('../../config');
const mock = require('./mock.adapter');

const PROVIDERS = { mock };

module.exports = PROVIDERS[config.payments.provider] || mock;
