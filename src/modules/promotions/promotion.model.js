'use strict';

module.exports = (sequelize, DataTypes) => {
  const Promotion = sequelize.define(
    'Promotion',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.STRING(500) },
      type: { type: DataTypes.ENUM('PERCENTAGE', 'FIXED'), allowNull: false },
      value: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
      minOrderAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      maxDiscountAmount: { type: DataTypes.DECIMAL(12, 2) },
      startsAt: { type: DataTypes.DATE },
      endsAt: { type: DataTypes.DATE },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      stackable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      firstOrderOnly: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      customerId: { type: DataTypes.UUID },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'promotions', timestamps: true }
  );

  Promotion.associate = (db) => {
    Promotion.hasMany(db.PromotionRule, { foreignKey: 'promotion_id', as: 'rules' });
    Promotion.hasMany(db.Coupon, { foreignKey: 'promotion_id', as: 'coupons' });
    Promotion.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
  };

  return Promotion;
};
