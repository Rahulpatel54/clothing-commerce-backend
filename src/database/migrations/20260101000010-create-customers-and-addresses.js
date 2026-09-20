'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      date_of_birth: { type: Sequelize.DATEONLY },
      gender: { type: Sequelize.STRING(20) },
      acquisition_source: { type: Sequelize.STRING(50) },
      notes: { type: Sequelize.TEXT },
      tags: { type: Sequelize.ARRAY(Sequelize.STRING(50)), allowNull: false, defaultValue: [] },
      marketing_email: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      marketing_sms: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      marketing_whatsapp: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      marketing_opt_out_at: { type: Sequelize.DATE },
      total_spend: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      order_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_purchase_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('customers', ['user_id'], { unique: true, name: 'customers_user_unique' });
    await queryInterface.addIndex('customers', ['total_spend'], { name: 'customers_total_spend_idx' });
    await queryInterface.addIndex('customers', ['last_purchase_at'], { name: 'customers_last_purchase_idx' });
    await queryInterface.addIndex('customers', ['tags'], { using: 'gin', name: 'customers_tags_gin' });
    await queryInterface.addConstraint('customers', { fields: ['total_spend'], type: 'check', name: 'customers_total_spend_non_negative', where: { total_spend: { [Sequelize.Op.gte]: 0 } } });
    await queryInterface.addConstraint('customers', { fields: ['order_count'], type: 'check', name: 'customers_order_count_non_negative', where: { order_count: { [Sequelize.Op.gte]: 0 } } });

    await queryInterface.createTable('addresses', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      customer_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      label: { type: Sequelize.STRING(50) },
      recipient_name: { type: Sequelize.STRING(150), allowNull: false },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      line1: { type: Sequelize.STRING(255), allowNull: false },
      line2: { type: Sequelize.STRING(255) },
      landmark: { type: Sequelize.STRING(150) },
      city: { type: Sequelize.STRING(100), allowNull: false },
      state: { type: Sequelize.STRING(100), allowNull: false },
      postal_code: { type: Sequelize.STRING(20), allowNull: false },
      country: { type: Sequelize.STRING(2), allowNull: false, defaultValue: 'IN' },
      is_default_shipping: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_default_billing: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('addresses', ['customer_id'], { name: 'addresses_customer_idx' });
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX addresses_one_default_shipping ON addresses (customer_id) WHERE is_default_shipping AND deleted_at IS NULL;');
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX addresses_one_default_billing ON addresses (customer_id) WHERE is_default_billing AND deleted_at IS NULL;');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('addresses');
    await queryInterface.dropTable('customers');
  },
};
