'use strict';

const EVENT_TYPES = ['CLICK', 'VISIT', 'SIGNUP', 'CART_ADD', 'CHECKOUT_START', 'PURCHASE'];

module.exports = (sequelize, DataTypes) => {
  const CampaignEvent = sequelize.define(
    'CampaignEvent',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      campaignId: { type: DataTypes.UUID },
      customerId: { type: DataTypes.UUID },
      sessionId: { type: DataTypes.STRING(128) },
      eventType: {
        type: DataTypes.ENUM(...EVENT_TYPES),
        allowNull: false,
      },
      metadata: { type: DataTypes.JSONB },
    },
    { tableName: 'campaign_events', timestamps: true, updatedAt: false }
  );

  CampaignEvent.EVENT_TYPES = EVENT_TYPES;

  CampaignEvent.associate = (db) => {
    CampaignEvent.belongsTo(db.Campaign, { foreignKey: 'campaign_id', as: 'campaign' });
    CampaignEvent.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
  };

  return CampaignEvent;
};
