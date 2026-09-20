'use strict';

module.exports = (sequelize, DataTypes) => {
  const WishlistItem = sequelize.define(
    'WishlistItem',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      customerId: { type: DataTypes.UUID, allowNull: false },
      productId: { type: DataTypes.UUID, allowNull: false },
    },
    { tableName: 'wishlist_items', timestamps: true, updatedAt: false }
  );

  WishlistItem.associate = (db) => {
    WishlistItem.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
    WishlistItem.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });
  };

  return WishlistItem;
};
