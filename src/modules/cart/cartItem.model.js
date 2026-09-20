'use strict';

module.exports = (sequelize, DataTypes) => {
  const CartItem = sequelize.define(
    'CartItem',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      cartId: { type: DataTypes.UUID, allowNull: false },
      variantId: { type: DataTypes.UUID, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1 } },
      priceAtAdd: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    },
    { tableName: 'cart_items', timestamps: true }
  );

  CartItem.associate = (db) => {
    CartItem.belongsTo(db.Cart, { foreignKey: 'cart_id', as: 'cart' });
    CartItem.belongsTo(db.ProductVariant, { foreignKey: 'variant_id', as: 'variant' });
  };

  return CartItem;
};
