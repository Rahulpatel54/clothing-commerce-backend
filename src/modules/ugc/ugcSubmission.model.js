'use strict';

const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'PINTEREST', 'TWITTER', 'OTHER'];
const MEDIA_TYPES = ['IMAGE', 'VIDEO', 'POST', 'STORY', 'REEL'];
const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED'];

module.exports = (sequelize, DataTypes) => {
  const UgcSubmission = sequelize.define(
    'UgcSubmission',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      customerId: { type: DataTypes.UUID, allowNull: false },
      orderId: { type: DataTypes.UUID, allowNull: false },
      productId: { type: DataTypes.UUID },
      platform: { type: DataTypes.ENUM(...PLATFORMS), allowNull: false },
      mediaType: { type: DataTypes.ENUM(...MEDIA_TYPES), allowNull: false },
      mediaUrl: { type: DataTypes.STRING(1024), allowNull: false },
      postUrl: { type: DataTypes.STRING(1024) },
      caption: { type: DataTypes.TEXT },
      status: { type: DataTypes.ENUM(...STATUS_OPTIONS), allowNull: false, defaultValue: 'PENDING' },
      orderVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      adminVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      rejectionReason: { type: DataTypes.TEXT },
      reviewedBy: { type: DataTypes.UUID },
      reviewedAt: { type: DataTypes.DATE },
    },
    { tableName: 'ugc_submissions', timestamps: true }
  );

  UgcSubmission.PLATFORMS = PLATFORMS;
  UgcSubmission.MEDIA_TYPES = MEDIA_TYPES;
  UgcSubmission.STATUS_OPTIONS = STATUS_OPTIONS;

  UgcSubmission.associate = (db) => {
    UgcSubmission.belongsTo(db.Customer, { foreignKey: 'customer_id', as: 'customer' });
    UgcSubmission.belongsTo(db.Order, { foreignKey: 'order_id', as: 'order' });
    UgcSubmission.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });
    UgcSubmission.belongsTo(db.User, { foreignKey: 'reviewed_by', as: 'reviewer' });
    UgcSubmission.hasOne(db.UgcReward, { foreignKey: 'submission_id', as: 'reward' });
  };

  return UgcSubmission;
};
