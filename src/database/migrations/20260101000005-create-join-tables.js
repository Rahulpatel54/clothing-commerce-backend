'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_roles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      role_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'roles', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('user_roles', { fields: ['user_id', 'role_id'], type: 'unique', name: 'user_roles_user_role_unique' });

    await queryInterface.createTable('role_permissions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      role_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'roles', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      permission_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'permissions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('role_permissions', { fields: ['role_id', 'permission_id'], type: 'unique', name: 'role_permissions_role_permission_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('role_permissions');
    await queryInterface.dropTable('user_roles');
  },
};
