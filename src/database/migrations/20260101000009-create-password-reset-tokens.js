'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('password_reset_tokens', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      used_at: { type: Sequelize.DATE },
      request_ip: { type: Sequelize.STRING(64) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('password_reset_tokens', ['token_hash'], { unique: true, name: 'password_reset_tokens_hash_unique' });
    await queryInterface.addIndex('password_reset_tokens', ['user_id'], { name: 'password_reset_tokens_user_idx' });
  },
  async down(queryInterface) { await queryInterface.dropTable('password_reset_tokens'); },
};
