'use strict';

module.exports = (sequelize, DataTypes) => {
  const Refund = sequelize.define(
    'Refund',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      paymentId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
      reason: { type: DataTypes.STRING(255) },
      status: { type: DataTypes.ENUM('PENDING', 'COMPLETED', 'FAILED'), allowNull: false, defaultValue: 'PENDING' },
      providerRefundId: { type: DataTypes.STRING(100) },
      actorUserId: { type: DataTypes.UUID },
    },
    { tableName: 'refunds', timestamps: true }
  );

  Refund.associate = (db) => {
    Refund.belongsTo(db.Payment, { foreignKey: 'payment_id', as: 'payment' });
  };

  return Refund;
};
