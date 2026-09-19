'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('refresh_tokens', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      user_agent: { type: Sequelize.STRING(255) },
      ip_address: { type: Sequelize.STRING(64) },
      device_label: { type: Sequelize.STRING(100) },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE },
      revoked_reason: { type: Sequelize.STRING(50) },
      replaced_by_token_id: { type: Sequelize.UUID, references: { model: 'refresh_tokens', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('refresh_tokens', ['token_hash'], { unique: true, name: 'refresh_tokens_hash_unique' });
    await queryInterface.addIndex('refresh_tokens', ['user_id'], { name: 'refresh_tokens_user_idx' });
    await queryInterface.addIndex('refresh_tokens', ['expires_at'], { name: 'refresh_tokens_expires_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('refresh_tokens');
  },
};
