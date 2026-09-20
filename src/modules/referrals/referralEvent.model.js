'use strict';

const STAGES = ['LINK_CLICKED', 'SIGNED_UP', 'FIRST_PURCHASE', 'PAYMENT_SUCCESS', 'DELIVERED', 'RETURN_WINDOW_EXPIRED', 'VALIDATED', 'REWARD_ISSUED', 'FRAUD_FLAGGED', 'CANCELLED'];

module.exports = (sequelize, DataTypes) => {
  const ReferralEvent = sequelize.define(
    'ReferralEvent',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      referralId: { type: DataTypes.UUID, allowNull: false },
      refereeUserId: { type: DataTypes.UUID },
      stage: { type: DataTypes.ENUM(...STAGES), allowNull: false },
      fraudSignals: { type: DataTypes.JSONB },
      orderId: { type: DataTypes.UUID },
    },
    { tableName: 'referral_events', timestamps: true, updatedAt: false }
  );

  ReferralEvent.STAGES = STAGES;
  ReferralEvent.associate = (db) => {
    ReferralEvent.belongsTo(db.Referral, { foreignKey: 'referral_id', as: 'referral' });
  };

  return ReferralEvent;
};
