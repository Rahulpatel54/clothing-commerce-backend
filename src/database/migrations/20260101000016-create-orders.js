'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      order_number: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      customer_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'customers', key: 'id' }, onDelete: 'RESTRICT' },
      status: {
        type: Sequelize.ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNED', 'REFUNDED'),
        allowNull: false, defaultValue: 'PENDING',
      },
      payment_status: { type: Sequelize.ENUM('UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'), allowNull: false, defaultValue: 'UNPAID' },
      shipping_address: { type: Sequelize.JSONB, allowNull: false },
      billing_address: { type: Sequelize.JSONB },
      subtotal: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      shipping_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      tax_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      discount_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      wallet_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      coupon_code: { type: Sequelize.STRING(32) },
      coupon_id: { type: Sequelize.UUID },
      idempotency_key: { type: Sequelize.STRING(128) },
      placed_at: { type: Sequelize.DATE },
      cancelled_at: { type: Sequelize.DATE },
      delivered_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('orders', ['order_number'], { unique: true, name: 'orders_number_unique' });
    await queryInterface.addIndex('orders', ['customer_id', 'created_at'], { name: 'orders_customer_time_idx' });
    await queryInterface.addIndex('orders', ['status'], { name: 'orders_status_idx' });
    await queryInterface.addConstraint('orders', { fields: ['total_amount'], type: 'check', name: 'orders_total_non_negative', where: { total_amount: { [Sequelize.Op.gte]: 0 } } });

    await queryInterface.createTable('order_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'orders', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      variant_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'product_variants', key: 'id' }, onDelete: 'RESTRICT' },
      product_id: { type: Sequelize.UUID, allowNull: false },
      // Snapshots: an order must read the same forever even if the catalog changes later.
      product_name: { type: Sequelize.STRING(200), allowNull: false },
      variant_sku: { type: Sequelize.STRING(64), allowNull: false },
      size: { type: Sequelize.STRING(20) },
      color: { type: Sequelize.STRING(50) },
      unit_price: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      cost_price: { type: Sequelize.DECIMAL(12, 2) },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      line_total: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('order_items', ['order_id'], { name: 'order_items_order_idx' });

    await queryInterface.createTable('order_status_history', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'orders', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      from_status: { type: Sequelize.STRING(30) },
      to_status: { type: Sequelize.STRING(30), allowNull: false },
      actor_user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      reason: { type: Sequelize.STRING(255) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('order_status_history', ['order_id', 'created_at'], { name: 'order_status_history_order_time_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('order_status_history');
    await queryInterface.dropTable('order_items');
    await queryInterface.dropTable('orders');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_status";');
  },
};
