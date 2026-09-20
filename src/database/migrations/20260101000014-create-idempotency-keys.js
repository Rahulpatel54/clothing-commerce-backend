'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('idempotency_keys', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      key: { type: Sequelize.STRING(128), allowNull: false },
      scope: { type: Sequelize.STRING(50), allowNull: false },
      request_fingerprint: { type: Sequelize.STRING(64) },
      status: { type: Sequelize.ENUM('IN_PROGRESS', 'COMPLETED'), allowNull: false, defaultValue: 'IN_PROGRESS' },
      response_body: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('idempotency_keys', { fields: ['key', 'scope'], type: 'unique', name: 'idempotency_keys_key_scope_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('idempotency_keys');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_idempotency_keys_status";');
  },
};
