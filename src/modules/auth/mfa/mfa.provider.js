'use strict';

const noopProvider = {
  name: 'noop',
  isEnabled: (user) => Boolean(user && user.mfaEnabled),
  async startChallenge(user) {
    return { required: false, method: null, challengeId: null, provider: this.name };
  },
  async verifyChallenge() {
    return true;
  },
};

let provider = noopProvider;

module.exports = {
  get: () => provider,
  set: (impl) => {
    provider = impl;
  },
  noopProvider,
};
