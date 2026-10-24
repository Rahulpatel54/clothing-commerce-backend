'use strict';

const FIT_OPTIONS = ['RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE'];
const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED'];

module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define(
    'Review',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      customerId: { type: DataTypes.UUID, allowNull: false },
      productId: { type: DataTypes.UUID, allowNull: false },
      variantId: { type: DataTypes.UUID, allowNull: false },
      orderId: { type: DataTypes.UUID },
      rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
      title: { type: DataTypes.STRING(255) },
      comment: { type: DataTypes.TEXT, allowNull: false },
      fit: { type: DataTypes.ENUM(...FIT_OPTIONS) },
      qualityRating: { type: DataTypes.INTEGER, validate: { min: 1, max: 5 } },
      isVerifiedPurchase: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: DataTypes.ENUM(...STATUS_OPTIONS), allowNull: false, defaultValue: 'PENDING' },
      moderationNote: { type: DataTypes.TEXT },
      moderatedBy: { type: DataTypes.UUID },
      moderatedAt: { type: DataTypes.DATE },
      helpfulCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'reviews', timestamps: true }
  );

  Review.FIT_OPTIONS = FIT_OPTIONS;
  Review.STATUS_OPTIONS = STATUS_OPTIONS;

  Review.associate = (db) => {
    Review.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
    Review.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });
    Review.belongsTo(db.ProductVariant, { foreignKey: 'variant_id', as: 'variant' });
    Review.belongsTo(db.Order, { foreignKey: 'order_id', as: 'order' });
    Review.belongsTo(db.User, { foreignKey: 'moderated_by', as: 'moderator' });
    Review.hasMany(db.ReviewImage, { foreignKey: 'review_id', as: 'images' });
  };

  return Review;
};
