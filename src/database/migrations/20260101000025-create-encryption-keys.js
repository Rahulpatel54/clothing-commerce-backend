'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('encryption_keys', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      key_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
      },
      encrypted_dek: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      algorithm: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'aes-256-gcm',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      retired_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('encryption_keys', ['key_version'], {
      unique: true,
      name: 'idx_encryption_keys_version',
    });
    await queryInterface.addIndex('encryption_keys', ['is_active'], {
      name: 'idx_encryption_keys_is_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('encryption_keys');
  },
};
