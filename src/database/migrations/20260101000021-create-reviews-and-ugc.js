'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reviews', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      customer_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE' },
      product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
      variant_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'product_variants', key: 'id' }, onDelete: 'CASCADE' },
      order_id: { type: Sequelize.UUID, references: { model: 'orders', key: 'id' }, onDelete: 'SET NULL' },
      rating: { type: Sequelize.INTEGER, allowNull: false },
      title: { type: Sequelize.STRING(255) },
      comment: { type: Sequelize.TEXT, allowNull: false },
      fit: { type: Sequelize.ENUM('RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE') },
      quality_rating: { type: Sequelize.INTEGER },
      is_verified_purchase: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED'), allowNull: false, defaultValue: 'PENDING' },
      moderation_note: { type: Sequelize.TEXT },
      moderated_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      moderated_at: { type: Sequelize.DATE },
      helpful_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addConstraint('reviews', {
      fields: ['customer_id', 'variant_id'],
      type: 'unique',
      name: 'reviews_customer_variant_unique',
    });
    await queryInterface.addIndex('reviews', ['product_id'], { name: 'reviews_product_idx' });
    await queryInterface.addIndex('reviews', ['variant_id'], { name: 'reviews_variant_idx' });
    await queryInterface.addIndex('reviews', ['customer_id'], { name: 'reviews_customer_idx' });
    await queryInterface.addIndex('reviews', ['status'], { name: 'reviews_status_idx' });
    await queryInterface.addIndex('reviews', ['product_id', 'status'], { name: 'reviews_product_status_idx' });

    await queryInterface.createTable('review_images', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      review_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'reviews', key: 'id' }, onDelete: 'CASCADE' },
      url: { type: Sequelize.STRING(1024), allowNull: false },
      alt_text: { type: Sequelize.STRING(255) },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('review_images', ['review_id'], { name: 'review_images_review_idx' });

    await queryInterface.createTable('ugc_submissions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      customer_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE' },
      order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'orders', key: 'id' }, onDelete: 'CASCADE' },
      product_id: { type: Sequelize.UUID, references: { model: 'products', key: 'id' }, onDelete: 'SET NULL' },
      platform: {
        type: Sequelize.ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'PINTEREST', 'TWITTER', 'OTHER'),
        allowNull: false,
      },
      media_type: {
        type: Sequelize.ENUM('IMAGE', 'VIDEO', 'POST', 'STORY', 'REEL'),
        allowNull: false,
      },
      media_url: { type: Sequelize.STRING(1024), allowNull: false },
      post_url: { type: Sequelize.STRING(1024) },
      caption: { type: Sequelize.TEXT },
      status: {
        type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      order_verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      admin_verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      rejection_reason: { type: Sequelize.TEXT },
      reviewed_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      reviewed_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('ugc_submissions', ['customer_id'], { name: 'ugc_submissions_customer_idx' });
    await queryInterface.addIndex('ugc_submissions', ['order_id'], { name: 'ugc_submissions_order_idx' });
    await queryInterface.addIndex('ugc_submissions', ['status'], { name: 'ugc_submissions_status_idx' });

    await queryInterface.createTable('ugc_rewards', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      submission_id: { type: Sequelize.UUID, allowNull: false, unique: true, references: { model: 'ugc_submissions', key: 'id' }, onDelete: 'CASCADE' },
      customer_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE' },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      wallet_transaction_id: { type: Sequelize.UUID, references: { model: 'wallet_transactions', key: 'id' }, onDelete: 'SET NULL' },
      issued_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('ugc_rewards', ['submission_id'], { unique: true, name: 'ugc_rewards_submission_unique' });
    await queryInterface.addIndex('ugc_rewards', ['customer_id'], { name: 'ugc_rewards_customer_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ugc_rewards');
    await queryInterface.dropTable('ugc_submissions');
    await queryInterface.dropTable('review_images');
    await queryInterface.dropTable('reviews');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_reviews_fit";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_reviews_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ugc_submissions_platform";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ugc_submissions_media_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ugc_submissions_status";');
  },
};
