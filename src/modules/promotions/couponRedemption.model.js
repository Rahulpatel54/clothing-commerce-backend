'use strict';

module.exports = (sequelize, DataTypes) => {
  const CouponRedemption = sequelize.define(
    'CouponRedemption',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      couponId: { type: DataTypes.UUID, allowNull: false },
      customerId: { type: DataTypes.UUID, allowNull: false },
      orderId: { type: DataTypes.UUID },
      discountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    },
    { tableName: 'coupon_redemptions', timestamps: true, updatedAt: false }
  );

  CouponRedemption.associate = (db) => {
    CouponRedemption.belongsTo(db.Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
    CouponRedemption.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
  };

  return CouponRedemption;
};
