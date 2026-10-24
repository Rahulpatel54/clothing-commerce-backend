'use strict';

module.exports = (sequelize, DataTypes) => {
  const ReviewImage = sequelize.define(
    'ReviewImage',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reviewId: { type: DataTypes.UUID, allowNull: false },
      url: { type: DataTypes.STRING(1024), allowNull: false },
      altText: { type: DataTypes.STRING(255) },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'review_images', timestamps: true }
  );

  ReviewImage.associate = (db) => {
    ReviewImage.belongsTo(db.Review, { foreignKey: 'review_id', as: 'review' });
  };

  return ReviewImage;
};
