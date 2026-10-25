'use strict';

const CHANNELS = ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WHATSAPP', 'ORGANIC', 'REFERRAL', 'DIRECT', 'EMAIL', 'OTHER'];

module.exports = (sequelize, DataTypes) => {
  const Campaign = sequelize.define(
    'Campaign',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      channel: {
        type: DataTypes.ENUM(...CHANNELS),
        allowNull: false,
        defaultValue: 'OTHER',
      },
      budget: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      audience: { type: DataTypes.STRING(255) },
      utmSource: { type: DataTypes.STRING(100) },
      utmMedium: { type: DataTypes.STRING(100) },
      utmCampaign: { type: DataTypes.STRING(100) },
      utmTerm: { type: DataTypes.STRING(100) },
      utmContent: { type: DataTypes.STRING(100) },
      discountCouponId: { type: DataTypes.UUID },
      startsAt: { type: DataTypes.DATE },
      endsAt: { type: DataTypes.DATE },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'campaigns', timestamps: true }
  );

  Campaign.CHANNELS = CHANNELS;

  Campaign.associate = (db) => {
    Campaign.belongsTo(db.Coupon, { foreignKey: 'discount_coupon_id', as: 'coupon' });
    Campaign.hasMany(db.CampaignEvent, { foreignKey: 'campaign_id', as: 'events' });
    Campaign.hasMany(db.Customer, { foreignKey: 'campaign_id', as: 'attributedCustomers' });
    Campaign.hasMany(db.Order, { foreignKey: 'campaign_id', as: 'attributedOrders' });
  };

  return Campaign;
};
