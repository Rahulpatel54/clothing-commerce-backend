'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');

const ACCESS = 'access';

function signAccessToken({ id, email, roles = [], permissions = [] }) {
  return jwt.sign({ sub: id, email, roles, permissions, type: ACCESS }, config.auth.accessSecret, {
    expiresIn: config.auth.accessExpiresIn,
  });
}

function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, config.auth.accessSecret);
    if (payload.type !== ACCESS) throw new Error('wrong token type');
    return payload;
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Access token expired');
    throw ApiError.unauthorized('Invalid access token');
  }
}

// Refresh tokens are opaque random strings; the database stores only their hash,
// so a database leak cannot be replayed against the API.
function generateRefreshToken() {
  const raw = crypto.randomBytes(48).toString('hex');
  return { raw, hash: hashToken(raw) };
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function parseDuration(value) {
  const match = /^(\d+)\s*([smhd])$/.exec(String(value).trim());
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return Number(match[1]) * unit;
}

function refreshExpiryDate(from = new Date()) {
  return new Date(from.getTime() + parseDuration(config.auth.refreshExpiresIn));
}

module.exports = { signAccessToken, verifyAccessToken, generateRefreshToken, hashToken, refreshExpiryDate };
