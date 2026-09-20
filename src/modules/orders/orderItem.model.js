'use strict';

module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define(
    'OrderItem',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderId: { type: DataTypes.UUID, allowNull: false },
      variantId: { type: DataTypes.UUID, allowNull: false },
      productId: { type: DataTypes.UUID, allowNull: false },
      productName: { type: DataTypes.STRING(200), allowNull: false },
      variantSku: { type: DataTypes.STRING(64), allowNull: false },
      size: { type: DataTypes.STRING(20) },
      color: { type: DataTypes.STRING(50) },
      unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      costPrice: { type: DataTypes.DECIMAL(12, 2) },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      lineTotal: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    },
    { tableName: 'order_items', timestamps: true }
  );

  OrderItem.associate = (db) => {
    OrderItem.belongsTo(db.Order, { foreignKey: 'order_id', as: 'order' });
    OrderItem.belongsTo(db.ProductVariant, { foreignKey: 'variant_id', as: 'variant' });
  };

  return OrderItem;
};
