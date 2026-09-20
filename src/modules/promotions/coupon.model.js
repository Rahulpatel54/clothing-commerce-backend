'use strict';

module.exports = (sequelize, DataTypes) => {
  const Coupon = sequelize.define(
    'Coupon',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: {
        type: DataTypes.STRING(32), allowNull: false, unique: true,
        set(value) { this.setDataValue('code', String(value).trim().toUpperCase()); },
      },
      promotionId: { type: DataTypes.UUID, allowNull: false },
      usageLimit: { type: DataTypes.INTEGER },
      usageLimitPerCustomer: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      usedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'coupons', timestamps: true }
  );

  Coupon.associate = (db) => {
    Coupon.belongsTo(db.Promotion, { foreignKey: 'promotion_id', as: 'promotion' });
    Coupon.hasMany(db.CouponRedemption, { foreignKey: 'coupon_id', as: 'redemptions' });
  };

  return Coupon;
};
