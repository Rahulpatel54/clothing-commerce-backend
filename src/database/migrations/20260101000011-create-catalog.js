'use strict';

const timestamps = (Sequelize, { paranoid = true } = {}) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  ...(paranoid ? { deleted_at: { type: Sequelize.DATE } } : {}),
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('categories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      slug: { type: Sequelize.STRING(180), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT },
      parent_id: { type: Sequelize.UUID, references: { model: 'categories', key: 'id' }, onDelete: 'SET NULL' },
      image_url: { type: Sequelize.STRING(500) },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('categories', ['slug'], { unique: true, name: 'categories_slug_unique' });
    await queryInterface.addIndex('categories', ['parent_id'], { name: 'categories_parent_idx' });

    await queryInterface.createTable('collections', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      slug: { type: Sequelize.STRING(180), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT },
      image_url: { type: Sequelize.STRING(500) },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      starts_at: { type: Sequelize.DATE },
      ends_at: { type: Sequelize.DATE },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('collections', ['slug'], { unique: true, name: 'collections_slug_unique' });

    await queryInterface.createTable('products', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      slug: { type: Sequelize.STRING(180), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT },
      category_id: { type: Sequelize.UUID, references: { model: 'categories', key: 'id' }, onDelete: 'SET NULL' },
      sku: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      status: { type: Sequelize.ENUM('DRAFT', 'ACTIVE', 'ARCHIVED'), allowNull: false, defaultValue: 'DRAFT' },
      price: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      compare_at_price: { type: Sequelize.DECIMAL(12, 2) },
      cost_price: { type: Sequelize.DECIMAL(12, 2) },
      tags: { type: Sequelize.ARRAY(Sequelize.STRING(50)), allowNull: false, defaultValue: [] },
      material: { type: Sequelize.STRING(120) },
      gsm: { type: Sequelize.INTEGER },
      fit: { type: Sequelize.STRING(50) },
      care_instructions: { type: Sequelize.TEXT },
      is_featured: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sales_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      views_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      published_at: { type: Sequelize.DATE },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('products', ['slug'], { unique: true, name: 'products_slug_unique' });
    await queryInterface.addIndex('products', ['sku'], { unique: true, name: 'products_sku_unique' });
    await queryInterface.addIndex('products', ['status'], { name: 'products_status_idx' });
    await queryInterface.addIndex('products', ['category_id'], { name: 'products_category_idx' });
    await queryInterface.addIndex('products', ['price'], { name: 'products_price_idx' });
    await queryInterface.addIndex('products', ['sales_count'], { name: 'products_sales_count_idx' });
    await queryInterface.addIndex('products', ['published_at'], { name: 'products_published_at_idx' });
    await queryInterface.addIndex('products', ['tags'], { using: 'gin', name: 'products_tags_gin' });
    await queryInterface.addConstraint('products', {
      fields: ['price'],
      type: 'check',
      name: 'products_price_non_negative',
      where: { price: { [Sequelize.Op.gte]: 0 } },
    });
    // Discovery: trigram index for fuzzy name search, full-text index for phrase search.
    await queryInterface.sequelize.query('CREATE INDEX products_name_trgm ON products USING gin (name gin_trgm_ops);');
    await queryInterface.sequelize.query(
      "CREATE INDEX products_search_fts ON products USING gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || array_to_string(tags, ' ')));"
    );

    await queryInterface.createTable('product_variants', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      sku: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      size: { type: Sequelize.STRING(20), allowNull: false },
      color: { type: Sequelize.STRING(50), allowNull: false },
      color_hex: { type: Sequelize.STRING(7) },
      price: { type: Sequelize.DECIMAL(12, 2) },
      compare_at_price: { type: Sequelize.DECIMAL(12, 2) },
      cost_price: { type: Sequelize.DECIMAL(12, 2) },
      barcode: { type: Sequelize.STRING(64) },
      weight_grams: { type: Sequelize.INTEGER },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('product_variants', ['sku'], { unique: true, name: 'product_variants_sku_unique' });
    await queryInterface.addIndex('product_variants', ['product_id'], { name: 'product_variants_product_idx' });
    await queryInterface.addIndex('product_variants', ['size'], { name: 'product_variants_size_idx' });
    await queryInterface.addIndex('product_variants', ['color'], { name: 'product_variants_color_idx' });
    // One row per size+colour combination of a product.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX product_variants_product_size_color_unique ON product_variants (product_id, size, color) WHERE deleted_at IS NULL;'
    );

    await queryInterface.createTable('product_images', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      variant_id: { type: Sequelize.UUID, references: { model: 'product_variants', key: 'id' }, onDelete: 'SET NULL' },
      url: { type: Sequelize.STRING(500), allowNull: false },
      alt_text: { type: Sequelize.STRING(255) },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('product_images', ['product_id'], { name: 'product_images_product_idx' });
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX product_images_one_primary ON product_images (product_id) WHERE is_primary AND deleted_at IS NULL;'
    );

    await queryInterface.createTable('product_collections', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      collection_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'collections', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      ...timestamps(Sequelize, { paranoid: false }),
    });
    await queryInterface.addConstraint('product_collections', {
      fields: ['product_id', 'collection_id'],
      type: 'unique',
      name: 'product_collections_unique',
    });

    await queryInterface.createTable('product_views', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      customer_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      session_id: { type: Sequelize.STRING(64) },
      viewed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('product_views', ['product_id', 'viewed_at'], { name: 'product_views_product_time_idx' });
    await queryInterface.addIndex('product_views', ['customer_id', 'viewed_at'], { name: 'product_views_customer_time_idx' });
    await queryInterface.addIndex('product_views', ['session_id', 'viewed_at'], { name: 'product_views_session_time_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_views');
    await queryInterface.dropTable('product_collections');
    await queryInterface.dropTable('product_images');
    await queryInterface.dropTable('product_variants');
    await queryInterface.dropTable('products');
    await queryInterface.dropTable('collections');
    await queryInterface.dropTable('categories');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_products_status";');
  },
};