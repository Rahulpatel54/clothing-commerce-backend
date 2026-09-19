'use strict';

const fs = require('fs');
const path = require('path');
const { sequelize, Sequelize } = require('../config/sequelize');

const modulesDir = path.join(__dirname, '..', 'modules');
const db = {};

// Models live inside their own domain module (src/modules/<domain>/*.model.js);
// this registry loads them and wires associations in one place.
function loadModels(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) loadModels(full);
    else if (entry.name.endsWith('.model.js')) {
      const model = require(full)(sequelize, Sequelize.DataTypes);
      db[model.name] = model;
    }
  }
}

loadModels(modulesDir);

Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') model.associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
