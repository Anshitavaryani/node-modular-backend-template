const cron = require('node-cron');
const modules = require('./modules');

// Scheduled jobs that modules declare (`jobs`). Started once by index.js, unless JOBS_ENABLED=false.
// A job is { schedule: '<cron expression>', run: async () => {} }.
const start = () => {
    for (const m of modules) {
        for (const job of m.jobs ? m.jobs() : []) {
            cron.schedule(job.schedule, () => {
                Promise.resolve(job.run()).catch((error) => require('./core/logger').error('Scheduled job failed', error));
            });
        }
    }
};

module.exports = { start };
