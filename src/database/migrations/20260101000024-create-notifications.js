'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      customer_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'customers', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      channel: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      recipient: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      sent_at: {
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

    await queryInterface.addIndex('notifications', ['customer_id'], { name: 'idx_notifications_customer_id' });
    await queryInterface.addIndex('notifications', ['status'], { name: 'idx_notifications_status' });
    await queryInterface.addIndex('notifications', ['type'], { name: 'idx_notifications_type' });
    await queryInterface.addIndex('notifications', ['created_at'], { name: 'idx_notifications_created_at' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  },
};
