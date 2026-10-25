'use strict';

const bcrypt = require('bcrypt');
const { User } = require('../models');

async function main() {
  const hash = await bcrypt.hash('ChangeMe123!', 10);
  await User.update(
    {
      passwordHash: hash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      status: 'ACTIVE',
    },
    { where: { email: 'admin@example.com' } }
  );
  console.log('Admin password hash successfully set (length: ' + hash.length + ')');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
