'use strict';

// Consumed by sequelize-cli (via .sequelizerc) and by config/sequelize.js.
const config = require('./index');

const base = {
  username: config.db.user,
  password: config.db.password,
  database: config.db.name,
  host: config.db.host,
  port: config.db.port,
  dialect: 'postgres',
  logging: config.db.logging ? console.log : false,
  pool: config.db.pool,
  define: { underscored: true, freezeTableName: true, timestamps: true },
  dialectOptions: config.db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
};

module.exports = { development: base, test: { ...base }, production: base };
