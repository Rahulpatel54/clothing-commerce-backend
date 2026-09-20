'use strict';

const TYPES = ['PURCHASE_CREDIT', 'REFERRAL_CREDIT', 'UGC_CREDIT', 'BIRTHDAY_CREDIT', 'CAMPAIGN_CREDIT', 'COMPENSATION_CREDIT', 'REDEMPTION_DEBIT', 'EXPIRY_DEBIT', 'ORDER_PAYMENT_DEBIT'];

module.exports = (sequelize, DataTypes) => {
  const WalletTransaction = sequelize.define(
    'WalletTransaction',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      walletId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.ENUM(...TYPES), allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      expiresAt: { type: DataTypes.DATE },
      referenceType: { type: DataTypes.STRING(50) },
      referenceId: { type: DataTypes.STRING(100) },
      note: { type: DataTypes.STRING(255) },
    },
    { tableName: 'wallet_transactions', timestamps: true, updatedAt: false }
  );

  WalletTransaction.TYPES = TYPES;
  WalletTransaction.CREDIT_TYPES = ['PURCHASE_CREDIT', 'REFERRAL_CREDIT', 'UGC_CREDIT', 'BIRTHDAY_CREDIT', 'CAMPAIGN_CREDIT', 'COMPENSATION_CREDIT'];

  WalletTransaction.associate = (db) => {
    WalletTransaction.belongsTo(db.Wallet, { foreignKey: 'wallet_id', as: 'wallet' });
  };

  return WalletTransaction;
};
