'use strict';

const LocalKmsProvider = require('./local.kms');
const config = require('../../../config');

let instance = null;

function getKmsProvider() {
  if (instance) return instance;

  const providerType = config.security?.kmsProvider || 'local';

  switch (providerType.toLowerCase()) {
    case 'local':
    default:
      instance = new LocalKmsProvider();
      break;
  }

  return instance;
}

module.exports = {
  getKmsProvider,
  LocalKmsProvider,
};
