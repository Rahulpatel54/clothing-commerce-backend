'use strict';

const ApiError = require('../utils/ApiError');
const rbac = require('../modules/users/rbac.service');

function authorize(...required) {
  return async (req, res, next) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Authentication required');

      const granted = await rbac.permissionsFor(req);
      if (granted.has('*') || required.length === 0 || required.some((p) => granted.has(p))) return next();

      throw ApiError.forbidden(`Missing permission: ${required.join(' or ')}`);
    } catch (err) {
      return next(err);
    }
  };
}

function authorizeSelfOr(...required) {
  return async (req, res, next) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Authentication required');
      const targetId = req.params.id || req.params.userId;
      if (targetId && targetId === req.user.id) return next();
      return authorize(...required)(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = authorize;
module.exports.authorize = authorize;
module.exports.authorizeSelfOr = authorizeSelfOr;
