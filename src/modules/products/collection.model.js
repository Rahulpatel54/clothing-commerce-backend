'use strict';

module.exports = (sequelize, DataTypes) => {
  const Collection = sequelize.define(
    'Collection',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT },
      imageUrl: { type: DataTypes.STRING(500) },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      startsAt: { type: DataTypes.DATE },
      endsAt: { type: DataTypes.DATE },
    },
    { tableName: 'collections', paranoid: true }
  );

  Collection.associate = (db) => {
    Collection.belongsToMany(db.Product, { through: 'product_collections', foreignKey: 'collection_id', otherKey: 'product_id', as: 'products' });
  };

  return Collection;
};
