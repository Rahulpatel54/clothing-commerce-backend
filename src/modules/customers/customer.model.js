'use strict';

module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define(
    'Customer',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true },
      dateOfBirth: { type: DataTypes.DATEONLY },
      gender: { type: DataTypes.STRING(20) },
      acquisitionSource: { type: DataTypes.STRING(50) },
      notes: { type: DataTypes.TEXT },
      tags: { type: DataTypes.ARRAY(DataTypes.STRING(50)), defaultValue: [] },
      marketingEmail: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      marketingSms: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      marketingWhatsapp: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      marketingOptOutAt: { type: DataTypes.DATE },
      // Derived stats. Written only by the orders/payments phases; never accepted from a client.
      totalSpend: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      orderCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lastPurchaseAt: { type: DataTypes.DATE },
    },
    { tableName: 'customers', paranoid: true }
  );

  // Average order value is always computed, never stored, so it cannot drift.
  Customer.prototype.averageOrderValue = function averageOrderValue() {
    const count = Number(this.orderCount) || 0;
    return count === 0 ? 0 : Number((Number(this.totalSpend) / count).toFixed(2));
  };

  Customer.associate = (db) => {
    Customer.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
    Customer.hasMany(db.Address, { foreignKey: 'customer_id', as: 'addresses' });
  };

  return Customer;
};