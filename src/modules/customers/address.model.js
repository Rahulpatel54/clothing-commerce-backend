'use strict';

module.exports = (sequelize, DataTypes) => {
  const Address = sequelize.define(
    'Address',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      customerId: { type: DataTypes.UUID, allowNull: false },
      label: { type: DataTypes.STRING(50) },
      recipientName: { type: DataTypes.STRING(150), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      line1: { type: DataTypes.STRING(255), allowNull: false },
      line2: { type: DataTypes.STRING(255) },
      landmark: { type: DataTypes.STRING(150) },
      city: { type: DataTypes.STRING(100), allowNull: false },
      state: { type: DataTypes.STRING(100), allowNull: false },
      postalCode: { type: DataTypes.STRING(20), allowNull: false },
      country: { type: DataTypes.STRING(2), allowNull: false, defaultValue: 'IN' },
      isDefaultShipping: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isDefaultBilling: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: 'addresses', paranoid: true }
  );

  Address.associate = (db) => {
    Address.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
  };

  return Address;
};
