'use strict';

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      actorUserId: { type: DataTypes.UUID },
      action: { type: DataTypes.STRING(100), allowNull: false },
      entityType: { type: DataTypes.STRING(50), allowNull: false },
      entityId: { type: DataTypes.STRING(100) },
      beforeState: { type: DataTypes.JSONB },
      afterState: { type: DataTypes.JSONB },
      ipAddress: { type: DataTypes.STRING(64) },
      userAgent: { type: DataTypes.STRING(255) },
      requestId: { type: DataTypes.STRING(64) },
    },
    { tableName: 'audit_logs', timestamps: true, updatedAt: false }
  );

  AuditLog.associate = (db) => {
    AuditLog.belongsTo(db.User, { foreignKey: 'actor_user_id', as: 'actor' });
  };

  return AuditLog;
};
