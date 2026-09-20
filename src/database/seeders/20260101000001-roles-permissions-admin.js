'use strict';

const bcrypt = require('bcrypt');
const config = require('../../config');

const RESOURCES = [
  'users', 'customers', 'products', 'inventory', 'orders', 'payments',
  'promotions', 'referrals', 'loyalty', 'reviews', 'ugc', 'expenses',
  'finance', 'marketing', 'analytics', 'notifications', 'settings', 'cart', 'wishlist',
];
const ACTIONS = ['create', 'read', 'update', 'delete'];

const ROLES = [
  { name: 'admin', description: 'Full platform access' },
  { name: 'staff', description: 'Operations and fulfilment access' },
  { name: 'customer', description: 'Storefront customer' },
];

const STAFF_DENY = new Set(['users:delete', 'users:create', 'finance:delete', 'settings:update', 'settings:delete']);

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('roles', ROLES.map((r) => ({
      name: r.name, description: r.description, is_system: true, created_at: now, updated_at: now,
    })), { ignoreDuplicates: true });

    const permissions = [];
    RESOURCES.forEach((resource) => {
      ACTIONS.forEach((action) => {
        permissions.push({ name: `${resource}:${action}`, resource, action, description: `${action} ${resource}`, created_at: now, updated_at: now });
      });
    });
    await queryInterface.bulkInsert('permissions', permissions, { ignoreDuplicates: true });

    const [roleRows] = await queryInterface.sequelize.query('SELECT id, name FROM roles;');
    const [permRows] = await queryInterface.sequelize.query('SELECT id, name FROM permissions;');
    const roleId = Object.fromEntries(roleRows.map((r) => [r.name, r.id]));

    const rolePermissions = [];
    permRows.forEach((p) => {
      rolePermissions.push({ role_id: roleId.admin, permission_id: p.id, created_at: now, updated_at: now });
      if (!STAFF_DENY.has(p.name) && !p.name.startsWith('settings:')) {
        rolePermissions.push({ role_id: roleId.staff, permission_id: p.id, created_at: now, updated_at: now });
      }
    });
    await queryInterface.bulkInsert('role_permissions', rolePermissions, { ignoreDuplicates: true });

    const passwordHash = await bcrypt.hash(config.seed.adminPassword, config.auth.bcryptRounds);
    await queryInterface.bulkInsert('users', [{
      email: config.seed.adminEmail.toLowerCase(), password_hash: passwordHash, first_name: 'Platform', last_name: 'Admin',
      status: 'ACTIVE', email_verified_at: now, created_at: now, updated_at: now,
    }], { ignoreDuplicates: true });

    const [adminRows] = await queryInterface.sequelize.query(`SELECT id FROM users WHERE email = '${config.seed.adminEmail.toLowerCase()}' LIMIT 1;`);
    if (adminRows.length) {
      await queryInterface.bulkInsert('user_roles', [{ user_id: adminRows[0].id, role_id: roleId.admin, created_at: now, updated_at: now }], { ignoreDuplicates: true });
    }

    await queryInterface.bulkInsert('settings', [
      { key: 'currency', value: JSON.stringify({ code: 'INR', symbol: '\u20B9' }), description: 'Store currency', is_public: true, created_at: now, updated_at: now },
      { key: 'tax', value: JSON.stringify({ inclusive: true, defaultRate: 5 }), description: 'Default tax behaviour', is_public: false, created_at: now, updated_at: now },
      { key: 'cart', value: JSON.stringify({ expiryMinutes: 4320, maxQtyPerVariant: 5 }), description: 'Cart rules', is_public: false, created_at: now, updated_at: now },
    ], { ignoreDuplicates: true });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('settings', null, {});
    await queryInterface.bulkDelete('user_roles', null, {});
    await queryInterface.bulkDelete('role_permissions', null, {});
    await queryInterface.bulkDelete('users', { email: config.seed.adminEmail.toLowerCase() }, {});
    await queryInterface.bulkDelete('permissions', null, {});
    await queryInterface.bulkDelete('roles', null, {});
  },
};
