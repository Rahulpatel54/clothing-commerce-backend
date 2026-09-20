'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const { optionalAuthenticate } = require('../../middleware/authenticate');
const schema = require('./cart.validation');
const controller = require('./cart.controller');

const router = express.Router();

// Carts work for guests and signed-in customers alike; authentication is optional
// here and resolves req.customerId downstream when a valid token is present.
const resolveCustomer = async (req, res, next) => {
  await new Promise((resolve) => optionalAuthenticate(req, res, resolve));
  if (req.user) {
    try {
      // eslint-disable-next-line global-require
      const customerRepo = require('../customers/customer.repository');
      const customer = await customerRepo.findByUserId(req.user.id);
      req.customerId = customer ? customer.id : null;
    } catch (err) {
      req.customerId = null;
    }
  }
  next();
};

router.use(resolveCustomer);

/**
 * @openapi
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get the current cart (guest via X-Session-Id, or the signed-in customer)
 *     responses:
 *       200: { description: Cart with server-recomputed totals }
 *   delete:
 *     tags: [Cart]
 *     summary: Empty the cart
 *     responses:
 *       200: { description: Cart cleared }
 */
router.get('/', controller.getCart);
router.delete('/', controller.clear);

/**
 * @openapi
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add a variant to the cart, or increase its quantity
 *     responses:
 *       201: { description: Item added }
 *       409: { description: Not enough stock available }
 */
router.post('/items', validate(schema.addItem), controller.addItem);

/**
 * @openapi
 * /cart/items/{variantId}:
 *   patch:
 *     tags: [Cart]
 *     summary: Set the exact quantity for a line item (0 removes it)
 *     parameters: [{ in: path, name: variantId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Cart updated }
 *   delete:
 *     tags: [Cart]
 *     summary: Remove a line item
 *     parameters: [{ in: path, name: variantId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Item removed }
 */
router.patch('/items/:variantId', validate(schema.updateItem), controller.updateItem);
router.delete('/items/:variantId', validate(schema.removeItem), controller.removeItem);

module.exports = router;
