'use strict';

module.exports = (sequelize, DataTypes) => {
  const IdempotencyKey = sequelize.define(
    'IdempotencyKey',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      key: { type: DataTypes.STRING(128), allowNull: false },
      scope: { type: DataTypes.STRING(50), allowNull: false },
      requestFingerprint: { type: DataTypes.STRING(64) },
      status: { type: DataTypes.ENUM('IN_PROGRESS', 'COMPLETED'), allowNull: false, defaultValue: 'IN_PROGRESS' },
      responseBody: { type: DataTypes.JSONB },
    },
    { tableName: 'idempotency_keys', timestamps: true }
  );

  return IdempotencyKey;
};
