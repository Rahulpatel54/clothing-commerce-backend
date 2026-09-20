'use strict';

const PRODUCT_STATUS = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    'Product',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT },
      categoryId: { type: DataTypes.UUID },
      sku: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      status: { type: DataTypes.ENUM(...PRODUCT_STATUS), allowNull: false, defaultValue: 'DRAFT' },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
      compareAtPrice: { type: DataTypes.DECIMAL(12, 2), validate: { min: 0 } },
      costPrice: { type: DataTypes.DECIMAL(12, 2), validate: { min: 0 } },
      tags: { type: DataTypes.ARRAY(DataTypes.STRING(50)), allowNull: false, defaultValue: [] },
      material: { type: DataTypes.STRING(120) },
      gsm: { type: DataTypes.INTEGER, validate: { min: 0 } },
      fit: { type: DataTypes.STRING(50) },
      careInstructions: { type: DataTypes.TEXT },
      isFeatured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      salesCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      viewsCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      publishedAt: { type: DataTypes.DATE },
    },
    { tableName: 'products', paranoid: true, scopes: { published: { where: { status: 'ACTIVE' } } } }
  );

  Product.STATUS = PRODUCT_STATUS;

  Product.prototype.toPublicJSON = function toPublicJSON() {
    const json = this.toJSON();
    delete json.costPrice;
    if (Array.isArray(json.variants)) json.variants = json.variants.map((v) => {
      const copy = { ...v };
      delete copy.costPrice;
      return copy;
    });
    return json;
  };

  Product.associate = (db) => {
    Product.belongsTo(db.Category, { foreignKey: 'category_id', as: 'category' });
    Product.hasMany(db.ProductVariant, { foreignKey: 'product_id', as: 'variants' });
    Product.hasMany(db.ProductImage, { foreignKey: 'product_id', as: 'images' });
    Product.belongsToMany(db.Collection, { through: 'product_collections', foreignKey: 'product_id', otherKey: 'collection_id', as: 'collections' });
  };

  return Product;
};
