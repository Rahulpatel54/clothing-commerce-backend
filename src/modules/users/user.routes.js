'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize, authorizeSelfOr } = require('../../middleware/authorize');
const schema = require('./user.validation');
const controller = require('./user.controller');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('users:read'), validate(schema.list), controller.list);
router.post('/', authorize('users:create'), validate(schema.create), controller.create);
router.get('/:id', authorizeSelfOr('users:read'), validate(schema.byId), controller.get);
router.patch('/:id', authorizeSelfOr('users:update'), validate(schema.update), controller.update);
router.delete('/:id', authorize('users:delete'), validate(schema.byId), controller.remove);
router.patch('/:id/status', authorize('users:update'), validate(schema.changeStatus), controller.changeStatus);
router.put('/:id/roles', authorize('users:update'), validate(schema.assignRoles), controller.assignRoles);

module.exports = router;
