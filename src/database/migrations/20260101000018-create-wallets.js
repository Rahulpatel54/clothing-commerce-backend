'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wallets', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      customer_id: { type: Sequelize.UUID, allowNull: false, unique: true, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('wallets', ['customer_id'], { unique: true, name: 'wallets_customer_unique' });

    // Append-only ledger. Balance is always the sum of these rows (excluding expired
    // credits); it is never written or cached as a mutable column anywhere.
    await queryInterface.createTable('wallet_transactions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      wallet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'wallets', key: 'id' }, onDelete: 'CASCADE' },
      type: {
        type: Sequelize.ENUM('PURCHASE_CREDIT', 'REFERRAL_CREDIT', 'UGC_CREDIT', 'BIRTHDAY_CREDIT', 'CAMPAIGN_CREDIT', 'COMPENSATION_CREDIT', 'REDEMPTION_DEBIT', 'EXPIRY_DEBIT', 'ORDER_PAYMENT_DEBIT'),
        allowNull: false,
      },
      // Credits are positive, debits are negative; balance is simply the sum.
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      expires_at: { type: Sequelize.DATE },
      reference_type: { type: Sequelize.STRING(50) },
      reference_id: { type: Sequelize.STRING(100) },
      note: { type: Sequelize.STRING(255) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('wallet_transactions', ['wallet_id', 'created_at'], { name: 'wallet_transactions_wallet_time_idx' });
    await queryInterface.addIndex('wallet_transactions', ['expires_at'], { name: 'wallet_transactions_expires_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('wallet_transactions');
    await queryInterface.dropTable('wallets');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_wallet_transactions_type";');
  },
};
