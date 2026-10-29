// Database backup (npm run backup), as the starter's src/config/db_backup.js: a dump of the app database, gzipped into
// STORAGE_DIR/backups, keeping BACKUP_RETENTION_DAYS (default 14) days of files. Needs mariadb-dump or mysqldump on the
// PATH; the API image has it (docker compose run --rm api npm run backup).
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const config = require("../src/core/config/config");
const { BACKUPS_DIR } = require("../src/core/config/paths");
const logger = require("../src/core/logger");

const DUMP_TOOLS = ["mariadb-dump", "mysqldump"];

// Starts the first dump tool that is installed. The password goes in MYSQL_PWD, not the arguments, so `ps` never
// shows it.
const startDump = (args, env) =>
  new Promise((resolve, reject) => {
    const tryTool = (index) => {
      const child = spawn(DUMP_TOOLS[index], args, { env, stdio: ["ignore", "pipe", "pipe"] });
      child.once("spawn", () => resolve(child));
      child.once("error", (error) => {
        if (error.code !== "ENOENT") reject(error);
        else if (index + 1 < DUMP_TOOLS.length) tryTool(index + 1);
        else reject(new Error(`${DUMP_TOOLS.join(" or ")} is not installed`));
      });
    };
    tryTool(0);
  });

const runBackup = async () => {
  const { host, port, user, passwd, db } = config.databases.central;
  await fs.promises.mkdir(BACKUPS_DIR, { recursive: true });
  const file = path.join(BACKUPS_DIR, `${db}-${new Date().toISOString().replace(/[:.]/g, "-")}.sql.gz`);
  const child = await startDump(
    [
      `--host=${host}`,
      `--port=${port}`,
      `--user=${user}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      "--default-character-set=utf8mb4",
      db,
    ],
    { ...process.env, MYSQL_PWD: passwd || "" }
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exited = new Promise((resolve) => child.once("close", resolve));
  try {
    await pipeline(child.stdout, zlib.createGzip(), fs.createWriteStream(file));
    const code = await exited;
    if (code !== 0) throw new Error(`the dump exited with code ${code}: ${stderr.trim()}`);
  } catch (error) {
    // A partial file is not a backup.
    await fs.promises.rm(file, { force: true });
    throw error;
  }
  return file;
};

// Deletes backups older than the retention period.
const removeOldBackups = async () => {
  const cutoff = Date.now() - config.backupRetentionDays * 24 * 60 * 60 * 1000;
  for (const name of await fs.promises.readdir(BACKUPS_DIR)) {
    const file = path.join(BACKUPS_DIR, name);
    const stats = await fs.promises.stat(file);
    if (stats.isFile() && stats.mtimeMs < cutoff) {
      await fs.promises.rm(file);
      logger.info(`Old backup removed: ${name}`);
    }
  }
};

runBackup()
  .then(async (file) => {
    logger.info(`Backup written: ${file}`);
    await removeOldBackups();
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`Backup failed: ${error.message}`);
    process.exit(1);
  });
