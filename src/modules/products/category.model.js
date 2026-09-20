'use strict';

module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    'Category',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT },
      parentId: { type: DataTypes.UUID },
      imageUrl: { type: DataTypes.STRING(500) },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'categories', paranoid: true }
  );

  Category.associate = (db) => {
    Category.belongsTo(db.Category, { foreignKey: 'parent_id', as: 'parent' });
    Category.hasMany(db.Category, { foreignKey: 'parent_id', as: 'children' });
    Category.hasMany(db.Product, { foreignKey: 'category_id', as: 'products' });
  };

  return Category;
};
