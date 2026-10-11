'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const schema = require('./checkout.validation');
const controller = require('./checkout.controller');

const router = express.Router();

router.post('/', authenticate, validate(schema.checkout), controller.checkout);

module.exports = router;
