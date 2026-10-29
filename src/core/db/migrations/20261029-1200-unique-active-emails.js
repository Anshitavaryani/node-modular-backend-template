// One active account per email, enforced by the database: per role for users, across all admins. The starter meant to
// add this (its migrations 20260817120000 and 20260817120001), and isEmailTaken() alone lets two near-simultaneous
// registrations with the same email both succeed.
// MariaDB/MySQL have no partial unique index. Each table gets a stored generated column, not_deleted, that is 1 while
// the row is live and NULL once it is soft-deleted, and a unique index that includes it: NULLs never collide, so a
// deactivated account frees its email. (The starter generated a key from email and role_id; MariaDB and MySQL refuse
// a stored generated column built on role_id, whose foreign key cascades on update.)
// On a database that already holds two live rows with the same email (and role), this fails; remove the duplicates.
module.exports = {
    up: async ({ sequelize }) => {
        for (const table of ['users', 'admins']) {
            await sequelize.query(`
                ALTER TABLE ${table}
                ADD COLUMN not_deleted TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED`);
        }
        await sequelize.query('CREATE UNIQUE INDEX users_email_role_active_unique ON users (email, role_id, not_deleted)');
        await sequelize.query('CREATE UNIQUE INDEX admins_email_active_unique ON admins (email, not_deleted)');
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP INDEX admins_email_active_unique ON admins');
        await sequelize.query('DROP INDEX users_email_role_active_unique ON users');
        for (const table of ['users', 'admins']) await sequelize.query(`ALTER TABLE ${table} DROP COLUMN not_deleted`);
    },
};
