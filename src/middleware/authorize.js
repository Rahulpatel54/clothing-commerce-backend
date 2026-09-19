'use strict';

const ApiError = require('../utils/ApiError');
const rbac = require('../modules/users/rbac.service');

/**
 * authorize('products:create', 'products:update') -> express middleware.
 * Passes when the user holds ANY of the listed permissions. Admins pass everything.
 * Permissions are resolved user -> roles -> permissions once per request and cached on req.
 */
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

/**
 * Customer-scoped resources: the owner may act on their own record, anyone else
 * needs the admin-level permission. Guards against IDOR on every :id route.
 */
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