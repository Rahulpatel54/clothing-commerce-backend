'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./inventory.service');

const getStock = catchAsync(async (req, res) => success(res, { data: await service.getStock(req.params.variantId) }));

const listMovements = catchAsync(async (req, res) => {
  const { page, limit } = getPagination(req.query);
  const { rows, count } = await service.listMovements({ variantId: req.query.variantId, page, limit });
  return paginated(res, { rows, count, page, limit });
});

const receive = catchAsync(async (req, res) =>
  success(res, {
    data: service.present(await service.receivePurchase({ ...req.body, actorUserId: req.user.id })),
    message: 'Stock received', statusCode: 201,
  })
);

const damage = catchAsync(async (req, res) =>
  success(res, { data: service.present(await service.reportDamage({ ...req.body, actorUserId: req.user.id })), message: 'Damage recorded' })
);

const adjust = catchAsync(async (req, res) =>
  success(res, { data: service.present(await service.adjust({ ...req.body, actorUserId: req.user.id })), message: 'Stock adjusted' })
);

module.exports = { getStock, listMovements, receive, damage, adjust };
