'use strict';

const ApiError = require('../utils/ApiError');
const tokens = require('../modules/auth/token.service');
const repo = require('../modules/auth/auth.repository');

function extract(req) {
  const header = req.headers.authorization || '';
  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;
  return value;
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
  return authenticate(req, res, (err) => (err ? next() : next()));
};

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.optionalAuthenticate = optionalAuthenticate;
