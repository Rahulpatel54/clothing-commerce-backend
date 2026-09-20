'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProductVariant = sequelize.define(
    'ProductVariant',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productId: { type: DataTypes.UUID, allowNull: false },
      sku: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      size: { type: DataTypes.STRING(20), allowNull: false },
      color: { type: DataTypes.STRING(50), allowNull: false },
      colorHex: { type: DataTypes.STRING(7) },
      price: { type: DataTypes.DECIMAL(12, 2), validate: { min: 0 } },
      compareAtPrice: { type: DataTypes.DECIMAL(12, 2), validate: { min: 0 } },
      costPrice: { type: DataTypes.DECIMAL(12, 2), validate: { min: 0 } },
      barcode: { type: DataTypes.STRING(64) },
      weightGrams: { type: DataTypes.INTEGER, validate: { min: 0 } },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'product_variants', paranoid: true }
  );

  ProductVariant.associate = (db) => {
    ProductVariant.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });
    ProductVariant.hasMany(db.ProductImage, { foreignKey: 'variant_id', as: 'images' });
    ProductVariant.hasOne(db.Inventory, { foreignKey: 'variant_id', as: 'inventory' });
  };

  return ProductVariant;
};
