'use strict';

const USER_STATUS = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'];

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
        set(value) {
          this.setDataValue('email', String(value).trim().toLowerCase());
        },
      },
      phone: { type: DataTypes.STRING(20), unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      firstName: { type: DataTypes.STRING(100) },
      lastName: { type: DataTypes.STRING(100) },
      status: { type: DataTypes.ENUM(...USER_STATUS), allowNull: false, defaultValue: 'ACTIVE' },
      emailVerifiedAt: { type: DataTypes.DATE },
      phoneVerifiedAt: { type: DataTypes.DATE },
      mfaEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      mfaSecretEncrypted: { type: DataTypes.TEXT }, // filled via the encryption service later
      lastLoginAt: { type: DataTypes.DATE },
      failedLoginAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lockedUntil: { type: DataTypes.DATE },
    },
    {
      tableName: 'users',
      paranoid: true,
      defaultScope: { attributes: { exclude: ['passwordHash', 'mfaSecretEncrypted'] } },
      scopes: { withSecrets: { attributes: { include: ['passwordHash', 'mfaSecretEncrypted'] } } },
    }
  );

  User.STATUS = USER_STATUS;

  User.associate = (db) => {
    User.belongsToMany(db.Role, { through: 'user_roles', foreignKey: 'user_id', otherKey: 'role_id', as: 'roles' });
  };

  return User;
};
