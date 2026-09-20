'use strict';

const CART_STATUS = ['ACTIVE', 'MERGED', 'CONVERTED', 'EXPIRED'];

module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define(
    'Cart',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      customerId: { type: DataTypes.UUID },
      sessionId: { type: DataTypes.STRING(64) },
      status: { type: DataTypes.ENUM(...CART_STATUS), allowNull: false, defaultValue: 'ACTIVE' },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: 'carts', timestamps: true }
  );

  Cart.STATUS = CART_STATUS;

  Cart.associate = (db) => {
    Cart.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
    Cart.hasMany(db.CartItem, { foreignKey: 'cart_id', as: 'items' });
  };

  return Cart;
};
