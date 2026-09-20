'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promotions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING(150), allowNull: false },
      description: { type: Sequelize.STRING(500) },
      type: { type: Sequelize.ENUM('PERCENTAGE', 'FIXED'), allowNull: false },
      value: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      min_order_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      max_discount_amount: { type: Sequelize.DECIMAL(12, 2) },
      starts_at: { type: Sequelize.DATE },
      ends_at: { type: Sequelize.DATE },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      stackable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      first_order_only: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      customer_id: { type: Sequelize.UUID, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE' },
      priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('promotions', ['is_active'], { name: 'promotions_active_idx' });

    await queryInterface.createTable('promotion_rules', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      promotion_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'promotions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      rule_type: { type: Sequelize.ENUM('PRODUCT_INCLUDE', 'PRODUCT_EXCLUDE', 'CATEGORY_INCLUDE', 'CATEGORY_EXCLUDE'), allowNull: false },
      target_id: { type: Sequelize.UUID, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('promotion_rules', ['promotion_id'], { name: 'promotion_rules_promotion_idx' });

    await queryInterface.createTable('coupons', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      code: { type: Sequelize.STRING(32), allowNull: false, unique: true },
      promotion_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'promotions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      usage_limit: { type: Sequelize.INTEGER },
      usage_limit_per_customer: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      used_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('coupons', ['code'], { unique: true, name: 'coupons_code_unique' });

    await queryInterface.createTable('coupon_redemptions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      coupon_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'coupons', key: 'id' }, onDelete: 'CASCADE' },
      customer_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE' },
      order_id: { type: Sequelize.UUID },
      discount_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('coupon_redemptions', ['coupon_id', 'customer_id'], { name: 'coupon_redemptions_coupon_customer_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('coupon_redemptions');
    await queryInterface.dropTable('coupons');
    await queryInterface.dropTable('promotion_rules');
    await queryInterface.dropTable('promotions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_promotions_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_promotion_rules_rule_type";');
  },
};
