'use strict';

module.exports = (sequelize, DataTypes) => {
  const Wallet = sequelize.define(
    'Wallet',
    { id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true }, customerId: { type: DataTypes.UUID, allowNull: false, unique: true } },
    { tableName: 'wallets', timestamps: true }
  );

  Wallet.associate = (db) => {
    Wallet.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
    Wallet.hasMany(db.WalletTransaction, { foreignKey: 'wallet_id', as: 'transactions' });
  };

  return Wallet;
};
