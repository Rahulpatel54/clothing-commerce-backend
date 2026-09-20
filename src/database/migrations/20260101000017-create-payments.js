'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'orders', key: 'id' }, onDelete: 'RESTRICT' },
      provider: { type: Sequelize.STRING(30), allowNull: false },
      provider_payment_id: { type: Sequelize.STRING(100) },
      amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'INR' },
      method: { type: Sequelize.STRING(30) },
      status: { type: Sequelize.ENUM('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'), allowNull: false, defaultValue: 'CREATED' },
      idempotency_key: { type: Sequelize.STRING(128) },
      // Dedupes webhook deliveries: a provider event id lands here once and is skipped on replay.
      processed_events: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      raw_response: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('payments', ['order_id'], { name: 'payments_order_idx' });
    await queryInterface.addIndex('payments', ['provider_payment_id'], { name: 'payments_provider_payment_idx' });

    await queryInterface.createTable('refunds', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      payment_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'payments', key: 'id' }, onDelete: 'CASCADE' },
      amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      reason: { type: Sequelize.STRING(255) },
      status: { type: Sequelize.ENUM('PENDING', 'COMPLETED', 'FAILED'), allowNull: false, defaultValue: 'PENDING' },
      provider_refund_id: { type: Sequelize.STRING(100) },
      actor_user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('refunds', ['payment_id'], { name: 'refunds_payment_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('refunds');
    await queryInterface.dropTable('payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_refunds_status";');
  },
};
