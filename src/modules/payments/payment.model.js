'use strict';

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define(
    'Payment',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderId: { type: DataTypes.UUID, allowNull: false },
      provider: { type: DataTypes.STRING(30), allowNull: false },
      providerPaymentId: { type: DataTypes.STRING(100) },
      amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      method: { type: DataTypes.STRING(30) },
      status: { type: DataTypes.ENUM('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'), allowNull: false, defaultValue: 'CREATED' },
      idempotencyKey: { type: DataTypes.STRING(128) },
      processedEvents: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      rawResponse: { type: DataTypes.JSONB },
    },
    { tableName: 'payments', timestamps: true }
  );

  Payment.associate = (db) => {
    Payment.belongsTo(db.Order, { foreignKey: 'order_id', as: 'order' });
    Payment.hasMany(db.Refund, { foreignKey: 'payment_id', as: 'refunds' });
  };

  return Payment;
};
