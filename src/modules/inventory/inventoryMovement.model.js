'use strict';

const MOVEMENT_TYPES = ['PURCHASE', 'ORDER', 'RETURN', 'DAMAGE', 'ADJUSTMENT', 'RESERVE', 'RELEASE'];

module.exports = (sequelize, DataTypes) => {
  const InventoryMovement = sequelize.define(
    'InventoryMovement',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      variantId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.ENUM(...MOVEMENT_TYPES), allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      actorUserId: { type: DataTypes.UUID },
      referenceType: { type: DataTypes.STRING(50) },
      referenceId: { type: DataTypes.STRING(100) },
      note: { type: DataTypes.STRING(255) },
    },
    { tableName: 'inventory_movements', timestamps: true, updatedAt: false }
  );

  InventoryMovement.TYPES = MOVEMENT_TYPES;

  InventoryMovement.associate = (db) => {
    InventoryMovement.belongsTo(db.ProductVariant, { foreignKey: 'variant_id', as: 'variant' });
  };

  return InventoryMovement;
};
