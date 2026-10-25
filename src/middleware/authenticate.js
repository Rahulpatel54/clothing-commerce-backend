'use strict';

const ApiError = require('../utils/ApiError');
const tokens = require('../modules/auth/token.service');
const repo = require('../modules/auth/auth.repository');

function extract(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;

  const trimmed = header.trim();
  if (!trimmed || /^basic\s+/i.test(trimmed)) return null;

  // Extract the JWT token (eyJ...) if present in the header.
  // This cleanly handles cases where copying from Swagger UI accidentally captures
  // duplicate 'Bearer', quotes, or trailing JSON fields like:
  // 'eyJ...TYw",       "refreshToken": "..."'
  const jwtMatch = trimmed.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]*)?/);
  if (jwtMatch) {
    return jwtMatch[0];
  }

  // Fallback for non-standard/mock tokens in unit tests
  let token = trimmed;
  while (/^bearer\s+/i.test(token)) {
    token = token.replace(/^bearer\s+/i, '').trim();
  }
  token = token.replace(/^["'`\s]+|["'`\s;,]+$/g, '').trim();

  return token || null;
}

const authenticate = async (req, res, next) => {
  try {
    const token = extract(req);
    if (!token) throw ApiError.unauthorized('Authentication required');

    const payload = tokens.verifyAccessToken(token);
    const user = await repo.findUserById(payload.sub);
    if (!user) throw ApiError.unauthorized('Account no longer exists');
    if (user.status !== 'ACTIVE') throw ApiError.forbidden('This account is not active');

    req.user = {
      id: user.id,
      email: user.email,
      status: user.status,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
    };
    return next();
  } catch (err) {
    return next(err);
  }
};

const optionalAuthenticate = async (req, res, next) => {
  if (!extract(req)) return next();
  return authenticate(req, res, (err) => {
    if (err) req.authError = err;
    return next();
  });
};

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.optionalAuthenticate = optionalAuthenticate;
