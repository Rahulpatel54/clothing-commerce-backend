'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('carts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      customer_id: { type: Sequelize.UUID, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE' },
      session_id: { type: Sequelize.STRING(64) },
      status: { type: Sequelize.ENUM('ACTIVE', 'MERGED', 'CONVERTED', 'EXPIRED'), allowNull: false, defaultValue: 'ACTIVE' },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('carts', ['customer_id', 'status'], { name: 'carts_customer_status_idx' });
    await queryInterface.addIndex('carts', ['session_id', 'status'], { name: 'carts_session_status_idx' });
    // At most one ACTIVE cart per customer / per guest session.
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX carts_one_active_per_customer ON carts (customer_id) WHERE status = 'ACTIVE' AND customer_id IS NOT NULL;");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX carts_one_active_per_session ON carts (session_id) WHERE status = 'ACTIVE' AND session_id IS NOT NULL;");

    await queryInterface.createTable('cart_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      cart_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'carts', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      variant_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'product_variants', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      // Snapshot of the unit price when the item was added/last confirmed, used to detect stale prices at read time.
      price_at_add: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('cart_items', { fields: ['cart_id', 'variant_id'], type: 'unique', name: 'cart_items_cart_variant_unique' });
    await queryInterface.addConstraint('cart_items', { fields: ['quantity'], type: 'check', name: 'cart_items_quantity_positive', where: { quantity: { [Sequelize.Op.gt]: 0 } } });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('cart_items');
    await queryInterface.dropTable('carts');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_carts_status";');
  },
};
