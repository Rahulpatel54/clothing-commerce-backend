'use strict';

const ORDER_STATUS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNED', 'REFUNDED'];
const PAYMENT_STATUS = ['UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'];

module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define(
    'Order',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderNumber: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      customerId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.ENUM(...ORDER_STATUS), allowNull: false, defaultValue: 'PENDING' },
      paymentStatus: { type: DataTypes.ENUM(...PAYMENT_STATUS), allowNull: false, defaultValue: 'UNPAID' },
      shippingAddress: { type: DataTypes.JSONB, allowNull: false },
      billingAddress: { type: DataTypes.JSONB },
      subtotal: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
      shippingAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      taxAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      discountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      walletAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      totalAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, validate: { min: 0 } },
      couponCode: { type: DataTypes.STRING(32) },
      couponId: { type: DataTypes.UUID },
      idempotencyKey: { type: DataTypes.STRING(128) },
      placedAt: { type: DataTypes.DATE },
      cancelledAt: { type: DataTypes.DATE },
      deliveredAt: { type: DataTypes.DATE },
    },
    { tableName: 'orders', timestamps: true }
  );

  Order.STATUS = ORDER_STATUS;
  Order.PAYMENT_STATUS = PAYMENT_STATUS;

  Order.associate = (db) => {
    Order.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
    Order.hasMany(db.OrderItem, { foreignKey: 'order_id', as: 'items' });
    Order.hasMany(db.OrderStatusHistory, { foreignKey: 'order_id', as: 'history' });
    Order.hasMany(db.Payment, { foreignKey: 'order_id', as: 'payments' });
  };

  return Order;
};
