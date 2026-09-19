'use strict';

/**
 * MFA seam. Business code only ever talks to this interface, so TOTP (or SMS/WebAuthn)
 * can be introduced later without touching the auth service.
 *
 * Contract:
 *   isEnabled(user)                  -> boolean
 *   startChallenge(user)             -> { required: boolean, challengeId?: string, method?: string }
 *   verifyChallenge(user, payload)   -> boolean
 */
const noopProvider = {
  name: 'noop',
  isEnabled: (user) => Boolean(user && user.mfaEnabled),
  async startChallenge(user) {
    // No-op implementation: MFA is never demanded yet, even if the flag is set.
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
