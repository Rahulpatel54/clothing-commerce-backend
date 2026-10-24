'use strict';

module.exports = (sequelize, DataTypes) => {
  const UgcReward = sequelize.define(
    'UgcReward',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      submissionId: { type: DataTypes.UUID, allowNull: false, unique: true },
      customerId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      walletTransactionId: { type: DataTypes.UUID },
      issuedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: 'ugc_rewards', timestamps: true, updatedAt: false }
  );

  UgcReward.associate = (db) => {
    UgcReward.belongsTo(db.UgcSubmission, { foreignKey: 'submission_id', as: 'submission' });
    UgcReward.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
    UgcReward.belongsTo(db.WalletTransaction, { foreignKey: 'wallet_transaction_id', as: 'walletTransaction' });
  };

  return UgcReward;
};
