'use strict';

module.exports = (sequelize, DataTypes) => {
  const Referral = sequelize.define(
    'Referral',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      referrerCustomerId: { type: DataTypes.UUID, allowNull: false },
      code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    },
    { tableName: 'referrals', timestamps: true }
  );

  Referral.associate = (db) => {
    Referral.belongsTo(db.Customer, { foreignKey: 'referrer_customer_id', as: 'referrer' });
    Referral.hasMany(db.ReferralEvent, { foreignKey: 'referral_id', as: 'events' });
  };

  return Referral;
};
