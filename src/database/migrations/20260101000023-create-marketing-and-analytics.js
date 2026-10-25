'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    // 1. Create campaigns table
    if (!tables.includes('campaigns')) {
      await queryInterface.createTable('campaigns', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
        name: { type: Sequelize.STRING(100), allowNull: false },
        slug: { type: Sequelize.STRING(100), allowNull: false, unique: true },
        channel: {
          type: Sequelize.ENUM('INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WHATSAPP', 'ORGANIC', 'REFERRAL', 'DIRECT', 'EMAIL', 'OTHER'),
          allowNull: false,
          defaultValue: 'OTHER',
        },
        budget: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        audience: { type: Sequelize.STRING(255) },
        utm_source: { type: Sequelize.STRING(100) },
        utm_medium: { type: Sequelize.STRING(100) },
        utm_campaign: { type: Sequelize.STRING(100) },
        utm_term: { type: Sequelize.STRING(100) },
        utm_content: { type: Sequelize.STRING(100) },
        discount_coupon_id: { type: Sequelize.UUID, references: { model: 'coupons', key: 'id' }, onDelete: 'SET NULL' },
        starts_at: { type: Sequelize.DATE },
        ends_at: { type: Sequelize.DATE },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });

      await queryInterface.addIndex('campaigns', ['slug'], { unique: true, name: 'campaigns_slug_unique' });
      await queryInterface.addIndex('campaigns', ['channel'], { name: 'campaigns_channel_idx' });
      await queryInterface.addIndex('campaigns', ['is_active'], { name: 'campaigns_is_active_idx' });
      await queryInterface.addIndex('campaigns', ['utm_source', 'utm_medium', 'utm_campaign'], { name: 'campaigns_utm_idx' });
    }

    // 2. Create campaign_events table
    if (!tables.includes('campaign_events')) {
      await queryInterface.createTable('campaign_events', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
        campaign_id: { type: Sequelize.UUID, references: { model: 'campaigns', key: 'id' }, onDelete: 'CASCADE' },
        customer_id: { type: Sequelize.UUID, references: { model: 'customers', key: 'id' }, onDelete: 'SET NULL' },
        session_id: { type: Sequelize.STRING(128) },
        event_type: {
          type: Sequelize.ENUM('CLICK', 'VISIT', 'SIGNUP', 'CART_ADD', 'CHECKOUT_START', 'PURCHASE'),
          allowNull: false,
        },
        metadata: { type: Sequelize.JSONB },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });

      await queryInterface.addIndex('campaign_events', ['campaign_id'], { name: 'campaign_events_campaign_id_idx' });
      await queryInterface.addIndex('campaign_events', ['customer_id'], { name: 'campaign_events_customer_id_idx' });
      await queryInterface.addIndex('campaign_events', ['event_type'], { name: 'campaign_events_event_type_idx' });
      await queryInterface.addIndex('campaign_events', ['created_at'], { name: 'campaign_events_created_at_idx' });
    }

    // 3. Add attribution columns to customers and orders (safely check existing schema)
    const customerTable = await queryInterface.describeTable('customers');
    if (!customerTable.campaign_id) {
      await queryInterface.addColumn('customers', 'campaign_id', {
        type: Sequelize.UUID,
        references: { model: 'campaigns', key: 'id' },
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('customers', ['campaign_id'], { name: 'customers_campaign_id_idx' });
    }
    if (!customerTable.acquisition_source) {
      await queryInterface.addColumn('customers', 'acquisition_source', {
        type: Sequelize.STRING(50),
      });
    }

    const orderTable = await queryInterface.describeTable('orders');
    if (!orderTable.campaign_id) {
      await queryInterface.addColumn('orders', 'campaign_id', {
        type: Sequelize.UUID,
        references: { model: 'campaigns', key: 'id' },
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('orders', ['campaign_id'], { name: 'orders_campaign_id_idx' });
    }
    if (!orderTable.acquisition_source) {
      await queryInterface.addColumn('orders', 'acquisition_source', {
        type: Sequelize.STRING(50),
      });
    }
  },

  async down(queryInterface) {
    const orderTable = await queryInterface.describeTable('orders');
    if (orderTable.acquisition_source) await queryInterface.removeColumn('orders', 'acquisition_source');
    if (orderTable.campaign_id) await queryInterface.removeColumn('orders', 'campaign_id');

    const customerTable = await queryInterface.describeTable('customers');
    if (customerTable.campaign_id) await queryInterface.removeColumn('customers', 'campaign_id');

    await queryInterface.dropTable('campaign_events');
    await queryInterface.dropTable('campaigns');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_campaign_events_event_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_campaigns_channel";');
  },
};
