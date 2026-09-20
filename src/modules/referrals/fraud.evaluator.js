'use strict';

/**
 * Pluggable fraud scorer, the same seam pattern as the MFA provider: business
 * code only ever calls score(), so a smarter model can replace this without
 * touching referral.service. Never relies on a single signal — each factor
 * contributes independently and the scores are summed.
 *
 * signals: { ipReused, phoneReused, deviceReused, addressReused, accountAgeDays,
 *            referralVelocity24h, priorCancellationRate, priorReturnRate }
 */
const WEIGHTS = {
  ipReused: 25,
  phoneReused: 25,
  deviceReused: 20,
  addressReused: 15,
  highVelocity: 20, // referralVelocity24h > 5
  newAccount: 10, // accountAgeDays < 1
  highCancellation: 15, // priorCancellationRate > 0.5
  highReturnRate: 15, // priorReturnRate > 0.5
};

const THRESHOLD = 50;

function score(signals = {}) {
  let total = 0;
  if (signals.ipReused) total += WEIGHTS.ipReused;
  if (signals.phoneReused) total += WEIGHTS.phoneReused;
  if (signals.deviceReused) total += WEIGHTS.deviceReused;
  if (signals.addressReused) total += WEIGHTS.addressReused;
  if ((signals.referralVelocity24h || 0) > 5) total += WEIGHTS.highVelocity;
  if ((signals.accountAgeDays ?? 999) < 1) total += WEIGHTS.newAccount;
  if ((signals.priorCancellationRate || 0) > 0.5) total += WEIGHTS.highCancellation;
  if ((signals.priorReturnRate || 0) > 0.5) total += WEIGHTS.highReturnRate;
  return total;
}

function isSuspicious(signals) {
  return score(signals) >= THRESHOLD;
}

module.exports = { score, isSuspicious, THRESHOLD, WEIGHTS };
