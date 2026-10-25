'use strict';

const NOTIFICATION_TYPES = [
  'ORDER_CONFIRMED',
  'PAYMENT_SUCCESS',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'REWARD_EARNED',
  'REWARD_EXPIRING',
  'REFERRAL_SUCCESS',
  'BACK_IN_STOCK',
  'NEW_DROP',
  'LOW_STOCK_ALERT',
  'ABANDONED_CART',
  'REVIEW_REMINDER',
];

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'];
const STATUSES = ['PENDING', 'SENT', 'FAILED', 'CANCELLED'];

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    'Notification',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'customer_id',
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: { isIn: [NOTIFICATION_TYPES] },
      },
      channel: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [CHANNELS] },
      },
      recipient: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDING',
        validate: { isIn: [STATUSES] },
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'error_message',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'sent_at',
      },
    },
    {
      tableName: 'notifications',
      underscored: true,
      timestamps: true,
    }
  );

  Notification.TYPES = NOTIFICATION_TYPES;
  Notification.CHANNELS = CHANNELS;
  Notification.STATUSES = STATUSES;

  Notification.associate = (db) => {
    Notification.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
  };

  return Notification;
};
