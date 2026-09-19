'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      actor_user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      action: { type: Sequelize.STRING(100), allowNull: false },
      entity_type: { type: Sequelize.STRING(50), allowNull: false },
      entity_id: { type: Sequelize.STRING(100) },
      before_state: { type: Sequelize.JSONB },
      after_state: { type: Sequelize.JSONB },
      ip_address: { type: Sequelize.STRING(64) },
      user_agent: { type: Sequelize.STRING(255) },
      request_id: { type: Sequelize.STRING(64) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id'], { name: 'audit_logs_entity_idx' });
    await queryInterface.addIndex('audit_logs', ['actor_user_id'], { name: 'audit_logs_actor_idx' });
    await queryInterface.addIndex('audit_logs', ['created_at'], { name: 'audit_logs_created_at_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
