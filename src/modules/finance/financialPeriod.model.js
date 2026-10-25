'use strict';

module.exports = (sequelize, DataTypes) => {
  const FinancialPeriod = sequelize.define(
    'FinancialPeriod',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      startDate: { type: DataTypes.DATEONLY, allowNull: false },
      endDate: { type: DataTypes.DATEONLY, allowNull: false },
      isClosed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      closedAt: { type: DataTypes.DATE },
      closedBy: { type: DataTypes.UUID },
    },
    { tableName: 'financial_periods', timestamps: true }
  );

  FinancialPeriod.associate = (db) => {
    FinancialPeriod.belongsTo(db.User, { foreignKey: 'closed_by', as: 'closer' });
  };

  return FinancialPeriod;
};
