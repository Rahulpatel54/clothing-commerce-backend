'use strict';

module.exports = (sequelize, DataTypes) => {
  const Inventory = sequelize.define(
    'Inventory',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      variantId: { type: DataTypes.UUID, allowNull: false, unique: true },
      physical: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      reserved: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      sold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      returned: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      damaged: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'inventory', timestamps: true }
  );

  // available is always derived; it is never stored so it cannot drift from physical/reserved.
  Inventory.prototype.available = function available() {
    return Math.max(0, Number(this.physical) - Number(this.reserved));
  };

  Inventory.associate = (db) => {
    Inventory.belongsTo(db.ProductVariant, { foreignKey: 'variant_id', as: 'variant' });
  };

  return Inventory;
};
