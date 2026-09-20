'use strict';

module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define(
    'RefreshToken',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      userAgent: { type: DataTypes.STRING(255) },
      ipAddress: { type: DataTypes.STRING(64) },
      deviceLabel: { type: DataTypes.STRING(100) },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE },
      revokedReason: { type: DataTypes.STRING(50) },
      replacedByTokenId: { type: DataTypes.UUID },
    },
    { tableName: 'refresh_tokens', timestamps: true }
  );

  RefreshToken.prototype.isActive = function isActive() {
    return !this.revokedAt && this.expiresAt.getTime() > Date.now();
  };

  RefreshToken.associate = (db) => {
    RefreshToken.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
  };

  return RefreshToken;
};
