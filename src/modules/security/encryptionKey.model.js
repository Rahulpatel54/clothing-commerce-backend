'use strict';

module.exports = (sequelize, DataTypes) => {
  const EncryptionKey = sequelize.define(
    'EncryptionKey',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      keyVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: 'key_version',
      },
      encryptedDek: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'encrypted_dek',
      },
      algorithm: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'aes-256-gcm',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      retiredAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'retired_at',
      },
    },
    {
      tableName: 'encryption_keys',
      underscored: true,
      timestamps: true,
    }
  );

  return EncryptionKey;
};
