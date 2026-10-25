'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('expense_categories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      slug: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('expense_categories', ['slug'], { unique: true, name: 'expense_categories_slug_unique' });
    await queryInterface.addIndex('expense_categories', ['is_active'], { name: 'expense_categories_is_active_idx' });

    await queryInterface.createTable('financial_periods', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      is_closed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      closed_at: { type: Sequelize.DATE },
      closed_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('financial_periods', ['start_date', 'end_date'], { name: 'financial_periods_dates_idx' });
    await queryInterface.addIndex('financial_periods', ['is_closed'], { name: 'financial_periods_is_closed_idx' });

    await queryInterface.createTable('expenses', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      category_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'expense_categories', key: 'id' }, onDelete: 'RESTRICT' },
      amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      vendor: { type: Sequelize.STRING(255) },
      payment_method: { type: Sequelize.STRING(50) },
      description: { type: Sequelize.TEXT },
      receipt_url: { type: Sequelize.STRING(1024) },
      is_recurring: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      recurring_rule: { type: Sequelize.JSONB },
      status: {
        type: Sequelize.ENUM('PENDING', 'APPROVED', 'PAID', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      approved_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('expenses', ['category_id'], { name: 'expenses_category_id_idx' });
    await queryInterface.addIndex('expenses', ['date'], { name: 'expenses_date_idx' });
    await queryInterface.addIndex('expenses', ['status'], { name: 'expenses_status_idx' });
    await queryInterface.addIndex('expenses', ['date', 'status'], { name: 'expenses_date_status_idx' });

    // Seed standard core categories
    const standardCategories = [
      { name: 'Manufacturing', slug: 'manufacturing', description: 'Garment and apparel production runs' },
      { name: 'Fabric & Raw Materials', slug: 'fabric', description: 'Textiles, yarn, dyes, buttons, and zippers' },
      { name: 'Packaging', slug: 'packaging', description: 'Boxes, garment polybags, hangtags, and stickers' },
      { name: 'Shipping & Logistics', slug: 'shipping', description: 'Courier charges, freight, and fulfillment fees' },
      { name: 'Marketing & Advertising', slug: 'marketing', description: 'Ad spend, influencer campaigns, shoot production' },
      { name: 'Software & Tools', slug: 'software', description: 'SaaS subscriptions, hosting, and cloud infrastructure' },
      { name: 'Salaries & Wages', slug: 'salaries', description: 'Staff, contractor, and payroll expenses' },
      { name: 'Office & Facilities', slug: 'office', description: 'Rent, electricity, supplies, and maintenance' },
      { name: 'Transportation', slug: 'transportation', description: 'Travel, local dispatch, and vehicle expenses' },
    ];

    for (const cat of standardCategories) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.sequelize.query(
        `INSERT INTO expense_categories (id, name, slug, description, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), :name, :slug, :description, true, NOW(), NOW())
         ON CONFLICT (slug) DO NOTHING`,
        { replacements: cat }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('expenses');
    await queryInterface.dropTable('financial_periods');
    await queryInterface.dropTable('expense_categories');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_expenses_status";');
  },
};
