'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./customer.service');

const list = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /customers:
   *   get:
   *     tags: [Customers]
   *     summary: List customers with derived spend statistics (staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: search, schema: { type: string } }
   *       - { in: query, name: tag, schema: { type: string } }
   *       - { in: query, name: minSpend, schema: { type: number } }
   *       - { in: query, name: sort, schema: { type: string, enum: [createdAt, totalSpend, orderCount, lastPurchaseAt] } }
   *     responses:
   *       200: { description: Paginated customers }
   *       403: { $ref: '#/components/responses/Forbidden' }
   */
  const { page, limit, offset } = getPagination(req.query);
  const result = await service.list({ filters: req.query, page, limit, offset, sort: req.query.sort, order: req.query.order });
  return paginated(res, result);
});

const me = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /customers/me:
   *   get:
   *     tags: [Customers]
   *     summary: The signed-in customer's own profile
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Customer profile with stats and addresses }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  return success(res, { data: await service.getMine(req) });
});

const get = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /customers/{id}:
   *   get:
   *     tags: [Customers]
   *     summary: Get a customer (owner or staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Customer }
   *       403: { $ref: '#/components/responses/Forbidden' }
   */
  return success(res, { data: await service.get(req, req.params.id) });
});

const update = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /customers/{id}:
   *   patch:
   *     tags: [Customers]
   *     summary: Update profile fields (owner or staff). Spend stats are read-only and always stripped from the body.
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Customer updated }
   */
  return success(res, { data: await service.update(req, req.params.id, req.body), message: 'Customer updated' });
});

const marketing = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /customers/{id}/marketing-preferences:
   *   put:
   *     tags: [Customers]
   *     summary: Set channel opt-ins; turning all of them off records an opt-out timestamp
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [marketingEmail, marketingSms, marketingWhatsapp]
   *             properties: { marketingEmail: { type: boolean }, marketingSms: { type: boolean }, marketingWhatsapp: { type: boolean } }
   *     responses:
   *       200: { description: Preferences updated }
   */
  return success(res, { data: await service.setMarketingPreferences(req, req.params.id, req.body), message: 'Preferences updated' });
});

const listAddresses = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /customers/{id}/addresses:
   *   get:
   *     tags: [Customers]
   *     summary: List addresses (owner or staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Addresses }
   */
  return success(res, { data: await service.listAddresses(req, req.params.id) });
});

const addAddress = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /customers/{id}/addresses:
   *   post:
   *     tags: [Customers]
   *     summary: Add an address; the first one becomes the default for shipping and billing
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [recipientName, phone, line1, city, state, postalCode]
   *             properties:
   *               label: { type: string }
   *               recipientName: { type: string }
   *               phone: { type: string }
   *               line1: { type: string }
   *               line2: { type: string }
   *               city: { type: string }
   *               state: { type: string }
   *               postalCode: { type: string }
   *               country: { type: string, minLength: 2, maxLength: 2 }
   *               isDefaultShipping: { type: boolean }
   *               isDefaultBilling: { type: boolean }
   *     responses:
   *       201: { description: Address added }
   */
  return success(res, { data: await service.addAddress(req, req.params.id, req.body), message: 'Address added', statusCode: 201 });
});

const updateAddress = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /customers/{id}/addresses/{addressId}:
   *   patch:
   *     tags: [Customers]
   *     summary: Update an address (owner or staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *       - { in: path, name: addressId, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200: { description: Address updated }
   */
  return success(res, { data: await service.updateAddress(req, req.params.id, req.params.addressId, req.body), message: 'Address updated' });
});

const removeAddress = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /customers/{id}/addresses/{addressId}:
   *   delete:
   *     tags: [Customers]
   *     summary: Remove an address; a remaining address inherits the default flags
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *       - { in: path, name: addressId, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200: { description: Address removed }
   */
  return success(res, { data: await service.removeAddress(req, req.params.id, req.params.addressId), message: 'Address removed' });
});

module.exports = { list, me, get, update, marketing, listAddresses, addAddress, updateAddress, removeAddress };
