'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wishlist_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      customer_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('wishlist_items', { fields: ['customer_id', 'product_id'], type: 'unique', name: 'wishlist_items_customer_product_unique' });
    await queryInterface.addIndex('wishlist_items', ['customer_id'], { name: 'wishlist_items_customer_idx' });
  },
  async down(queryInterface) { await queryInterface.dropTable('wishlist_items'); },
};
