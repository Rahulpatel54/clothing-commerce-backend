'use strict';
require('dotenv').config();
process.env.DB_HOST = 'localhost';
const { sequelize } = require('../src/config/sequelize');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('Connection OK!');
    const [tables] = await sequelize.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    console.log('Tables:', tables.map(t => t.tablename).join(', '));
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

test();
