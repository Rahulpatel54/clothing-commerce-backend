'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProductView = sequelize.define(
    'ProductView',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productId: { type: DataTypes.UUID, allowNull: false },
      customerId: { type: DataTypes.UUID },
      sessionId: { type: DataTypes.STRING(64) },
      viewedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: 'product_views', timestamps: false }
  );

  ProductView.associate = (db) => {
    ProductView.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });
  };

  return ProductView;
};