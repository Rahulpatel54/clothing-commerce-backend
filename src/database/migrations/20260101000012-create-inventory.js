'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      variant_id: {
        type: Sequelize.UUID, allowNull: false, unique: true,
        references: { model: 'product_variants', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE',
      },
      // physical = total units owned. available = physical - reserved (computed, never stored).
      physical: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reserved: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      sold: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      returned: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      damaged: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('inventory', ['variant_id'], { unique: true, name: 'inventory_variant_unique' });
    await queryInterface.addConstraint('inventory', { fields: ['physical'], type: 'check', name: 'inventory_physical_non_negative', where: { physical: { [Sequelize.Op.gte]: 0 } } });
    await queryInterface.addConstraint('inventory', { fields: ['reserved'], type: 'check', name: 'inventory_reserved_non_negative', where: { reserved: { [Sequelize.Op.gte]: 0 } } });

    // Append-only ledger. Never updated or deleted; every stock change is one row here.
    await queryInterface.createTable('inventory_movements', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      variant_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'product_variants', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      type: { type: Sequelize.ENUM('PURCHASE', 'ORDER', 'RETURN', 'DAMAGE', 'ADJUSTMENT', 'RESERVE', 'RELEASE'), allowNull: false },
      // Positive = stock added back to physical availability semantics; the service decides sign per type.
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      actor_user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      reference_type: { type: Sequelize.STRING(50) },
      reference_id: { type: Sequelize.STRING(100) },
      note: { type: Sequelize.STRING(255) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('inventory_movements', ['variant_id', 'created_at'], { name: 'inventory_movements_variant_time_idx' });
    await queryInterface.addIndex('inventory_movements', ['reference_type', 'reference_id'], { name: 'inventory_movements_reference_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('inventory_movements');
    await queryInterface.dropTable('inventory');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_inventory_movements_type";');
  },
};
