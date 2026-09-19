'use strict';

module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define(
    'Permission',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      // Convention: "<resource>:<action>", e.g. products:create, orders:update_status
      name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      resource: { type: DataTypes.STRING(50), allowNull: false },
      action: { type: DataTypes.STRING(50), allowNull: false },
      description: { type: DataTypes.STRING(255) },
    },
    { tableName: 'permissions', paranoid: true }
  );

  Permission.associate = (db) => {
    Permission.belongsToMany(db.Role, {
      through: 'role_permissions',
      foreignKey: 'permission_id',
      otherKey: 'role_id',
      as: 'roles',
    });
  };

  return Permission;
};
