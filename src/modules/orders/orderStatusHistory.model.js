'use strict';

module.exports = (sequelize, DataTypes) => {
  const OrderStatusHistory = sequelize.define(
    'OrderStatusHistory',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderId: { type: DataTypes.UUID, allowNull: false },
      fromStatus: { type: DataTypes.STRING(30) },
      toStatus: { type: DataTypes.STRING(30), allowNull: false },
      actorUserId: { type: DataTypes.UUID },
      reason: { type: DataTypes.STRING(255) },
    },
    { tableName: 'order_status_history', timestamps: true, updatedAt: false }
  );

  OrderStatusHistory.associate = (db) => {
    OrderStatusHistory.belongsTo(db.Order, { foreignKey: 'order_id', as: 'order' });
  };

  return OrderStatusHistory;
};
