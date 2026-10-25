'use strict';

const { Notification, Customer, User, sequelize } = require('../../models');
const { Op } = require('sequelize');

class NotificationRepository {
  async create(data, options = {}) {
    return Notification.create(data, options);
  }

  async findById(id, options = {}) {
    return Notification.findByPk(id, {
      include: [
        {
          model: Customer,
          as: 'customer',
          include: [{ model: User, as: 'user', attributes: ['id', 'email', 'phone', 'firstName', 'lastName'] }],
        },
      ],
      ...options,
    });
  }

  async update(id, data, options = {}) {
    const record = await Notification.findByPk(id, options);
    if (!record) return null;
    return record.update(data, options);
  }

  async list({ customerId, status, type, channel, page = 1, limit = 20 } = {}) {
    const where = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (channel) where.channel = channel;

    const offset = (Math.max(1, page) - 1) * limit;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      limit: Math.min(100, Math.max(1, limit)),
      offset,
      order: [['createdAt', 'DESC']],
    });

    return { total: count, page: Number(page), limit: Number(limit), items: rows };
  }

  async findCustomerWithUser(customerId, options = {}) {
    if (!customerId) return null;
    return Customer.findByPk(customerId, {
      include: [{ model: User, as: 'user', attributes: ['id', 'email', 'phone', 'firstName', 'lastName'] }],
      ...options,
    });
  }

  async transaction(fn) {
    return sequelize.transaction(fn);
  }
}

module.exports = new NotificationRepository();
