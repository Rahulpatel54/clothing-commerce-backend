'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      phone: { type: Sequelize.STRING(20), unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      first_name: { type: Sequelize.STRING(100) },
      last_name: { type: Sequelize.STRING(100) },
      status: { type: Sequelize.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'), allowNull: false, defaultValue: 'ACTIVE' },
      email_verified_at: { type: Sequelize.DATE },
      phone_verified_at: { type: Sequelize.DATE },
      mfa_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      mfa_secret_encrypted: { type: Sequelize.TEXT },
      last_login_at: { type: Sequelize.DATE },
      failed_login_attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      locked_until: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE },
    });
    await queryInterface.addIndex('users', ['email'], { unique: true, name: 'users_email_unique' });
    await queryInterface.addIndex('users', ['status'], { name: 'users_status_idx' });
    await queryInterface.addIndex('users', ['created_at'], { name: 'users_created_at_idx' });
    await queryInterface.addConstraint('users', { fields: ['failed_login_attempts'], type: 'check', name: 'users_failed_login_attempts_non_negative', where: { failed_login_attempts: { [Sequelize.Op.gte]: 0 } } });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_status";');
  },
};
