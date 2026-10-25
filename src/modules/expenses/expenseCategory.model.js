'use strict';

module.exports = (sequelize, DataTypes) => {
  const ExpenseCategory = sequelize.define(
    'ExpenseCategory',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'expense_categories', timestamps: true }
  );

  ExpenseCategory.associate = (db) => {
    ExpenseCategory.hasMany(db.Expense, { foreignKey: 'category_id', as: 'expenses' });
  };

  return ExpenseCategory;
};
