'use strict';

const STATUSES = ['PENDING', 'APPROVED', 'PAID', 'CANCELLED'];

module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define(
    'Expense',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      vendor: { type: DataTypes.STRING(255) },
      paymentMethod: { type: DataTypes.STRING(50) },
      description: { type: DataTypes.TEXT },
      receiptUrl: { type: DataTypes.STRING(1024) },
      isRecurring: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      recurringRule: { type: DataTypes.JSONB },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      createdBy: { type: DataTypes.UUID },
      approvedBy: { type: DataTypes.UUID },
    },
    { tableName: 'expenses', timestamps: true }
  );

  Expense.STATUSES = STATUSES;

  Expense.associate = (db) => {
    Expense.belongsTo(db.ExpenseCategory, { foreignKey: 'category_id', as: 'category' });
    Expense.belongsTo(db.User, { foreignKey: 'created_by', as: 'creator' });
    Expense.belongsTo(db.User, { foreignKey: 'approved_by', as: 'approver' });
  };

  return Expense;
};
