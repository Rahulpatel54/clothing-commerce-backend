'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('referrals', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      referrer_customer_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE' },
      code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('referrals', ['code'], { unique: true, name: 'referrals_code_unique' });
    await queryInterface.addIndex('referrals', ['referrer_customer_id'], { name: 'referrals_referrer_idx' });

    await queryInterface.createTable('referral_events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      referral_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'referrals', key: 'id' }, onDelete: 'CASCADE' },
      referee_user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      stage: {
        type: Sequelize.ENUM('LINK_CLICKED', 'SIGNED_UP', 'FIRST_PURCHASE', 'PAYMENT_SUCCESS', 'DELIVERED', 'RETURN_WINDOW_EXPIRED', 'VALIDATED', 'REWARD_ISSUED', 'FRAUD_FLAGGED', 'CANCELLED'),
        allowNull: false,
      },
      // Fraud-signal schema: IP, phone, device, address reuse, account patterns, referral
      // velocity, cancellation/return history. Scored by a pluggable evaluator, never a single field.
      fraud_signals: { type: Sequelize.JSONB },
      order_id: { type: Sequelize.UUID },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('referral_events', ['referral_id', 'created_at'], { name: 'referral_events_referral_time_idx' });
    await queryInterface.addIndex('referral_events', ['referee_user_id'], { name: 'referral_events_referee_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('referral_events');
    await queryInterface.dropTable('referrals');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_referral_events_stage";');
  },
};
