'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProductImage = sequelize.define(
    'ProductImage',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productId: { type: DataTypes.UUID, allowNull: false },
      variantId: { type: DataTypes.UUID },
      url: { type: DataTypes.STRING(500), allowNull: false },
      altText: { type: DataTypes.STRING(255) },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: 'product_images', paranoid: true }
  );

  ProductImage.associate = (db) => {
    ProductImage.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });
    ProductImage.belongsTo(db.ProductVariant, { foreignKey: 'variant_id', as: 'variant' });
  };

  return ProductImage;
};