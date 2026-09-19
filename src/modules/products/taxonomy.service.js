'use strict';

const db = require('../../models');
const { Op } = require('sequelize');
const ApiError = require('../../utils/ApiError');
const { uniqueSlug } = require('../../utils/slugify');
const audit = require('../audit/audit.service');

// Categories and collections share the same shape of CRUD, so one factory serves both.
function taxonomy(modelName, label) {
  const Model = () => db[modelName];

  const slugExists = async (slug, ignoreId) =>
    Boolean(
      await Model().findOne({
        where: { slug, ...(ignoreId ? { id: { [Op.ne]: ignoreId } } : {}) },
        paranoid: false,
        attributes: ['id'],
      })
    );

  return {
    list: ({ includeInactive = false } = {}) =>
      Model().findAll({
        where: includeInactive ? {} : { isActive: true },
        order: [...(modelName === 'Category' ? [['position', 'ASC']] : []), ['name', 'ASC']],
      }),

    async getBySlug(slug) {
      const row = await Model().findOne({ where: { slug } });
      if (!row) throw ApiError.notFound(`${label} not found`);
      return row;
    },

    async create(req, payload) {
      if (payload.parentId) {
        const parent = await Model().findByPk(payload.parentId);
        if (!parent) throw ApiError.badRequest('Parent category does not exist');
      }
      const slug = await uniqueSlug(payload.slug || payload.name, slugExists);
      const row = await Model().create({ ...payload, slug });
      await audit.record(req, { action: `${label.toLowerCase()}.create`, entityType: modelName, entityId: row.id, after: row });
      return row;
    },

    async update(req, id, payload) {
      const row = await Model().findByPk(id);
      if (!row) throw ApiError.notFound(`${label} not found`);
      if (payload.parentId && payload.parentId === id) throw ApiError.badRequest('A category cannot be its own parent');

      const before = row.toJSON();
      const fields = { ...payload };
      if (payload.name && !payload.slug && payload.name !== row.name) {
        fields.slug = await uniqueSlug(payload.name, slugExists, { ignoreId: id });
      }
      await row.update(fields);
      await audit.record(req, { action: `${label.toLowerCase()}.update`, entityType: modelName, entityId: id, before, after: row });
      return row;
    },

    async remove(req, id) {
      const row = await Model().findByPk(id);
      if (!row) throw ApiError.notFound(`${label} not found`);
      if (modelName === 'Category') {
        const children = await Model().count({ where: { parentId: id } });
        if (children > 0) throw ApiError.conflict('Reassign or remove child categories first');
        const products = await db.Product.count({ where: { categoryId: id } });
        if (products > 0) throw ApiError.conflict('Reassign products before deleting this category');
      }
      await row.destroy();
      await audit.record(req, { action: `${label.toLowerCase()}.delete`, entityType: modelName, entityId: id, before: row });
      return { deleted: true };
    },
  };
}

module.exports = {
  categories: taxonomy('Category', 'Category'),
  collections: taxonomy('Collection', 'Collection'),
};