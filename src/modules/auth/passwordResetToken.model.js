'use strict';

module.exports = (sequelize, DataTypes) => {
  const PasswordResetToken = sequelize.define(
    'PasswordResetToken',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      usedAt: { type: DataTypes.DATE },
      requestIp: { type: DataTypes.STRING(64) },
    },
    { tableName: 'password_reset_tokens', timestamps: true }
  );

  PasswordResetToken.associate = (db) => {
    PasswordResetToken.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
  };

  return PasswordResetToken;
};
