'use strict';

const { Sequelize } = require('sequelize');
const config = require('./index');
const dbConfig = require('./database')[config.env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);

async function connect() {
  await sequelize.authenticate();
  return sequelize;
}

module.exports = { sequelize, Sequelize, connect };
