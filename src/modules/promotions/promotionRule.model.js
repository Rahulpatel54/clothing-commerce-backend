'use strict';

module.exports = (sequelize, DataTypes) => {
  const PromotionRule = sequelize.define(
    'PromotionRule',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      promotionId: { type: DataTypes.UUID, allowNull: false },
      ruleType: { type: DataTypes.ENUM('PRODUCT_INCLUDE', 'PRODUCT_EXCLUDE', 'CATEGORY_INCLUDE', 'CATEGORY_EXCLUDE'), allowNull: false },
      targetId: { type: DataTypes.UUID, allowNull: false },
    },
    { tableName: 'promotion_rules', timestamps: true }
  );

  PromotionRule.associate = (db) => {
    PromotionRule.belongsTo(db.Promotion, { foreignKey: 'promotion_id', as: 'promotion' });
  };

  return PromotionRule;
};
