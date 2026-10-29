// Creates the first super admin from SUPER_ADMIN_* in .env (npm run auth). Does nothing if the email is taken.
require("../src/models");
const config = require("../src/core/config/config");
const logger = require("../src/core/logger");
const db = require("../src/core/db/central.db");
const { Admin } = require("../src/models");
const { createAdminUser } = require("../src/shared/identity");

const run = async () => {
  const {
    SUPER_ADMIN_NAME: name,
    SUPER_ADMIN_EMAIL: email,
    SUPER_ADMIN_PASSWORD: password,
    SUP_ADM_ROLE_ID: role_id,
    ADM_DEPT_ID: department_id,
  } = config;

  if (!name || !email || !password || !role_id || !department_id) {
    logger.error(
      "Cannot create super admin: set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUP_ADM_ROLE_ID and ADM_DEPT_ID in .env"
    );
    return 1;
  }
  if (await Admin.isEmailTaken(email)) {
    logger.warn(`An admin with email ${email} already exists; nothing created.`);
    return 0;
  }
  await createAdminUser({ name, email, password, role_id, department_id });
  // The password is not logged: it is already in .env.
  logger.info(`Super admin created. Email: ${email} (password is the one set in SUPER_ADMIN_PASSWORD in .env)`);
  return 0;
};

run()
  .catch((error) => {
    logger.error(`Super admin creation failed: ${error.message}`);
    return 1;
  })
  .then(async (code) => {
    await db.close();
    process.exit(code);
  });
