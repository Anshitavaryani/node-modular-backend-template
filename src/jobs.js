const cron = require('node-cron');
const logger = require('./core/logger');
const modules = require('./modules');

// Scheduled jobs: the heartbeat (a log line every minute that shows the process is alive, as in the starter) and the
// jobs that modules declare (`jobs`). Started once by index.js, unless JOBS_ENABLED=false.
// A job is { schedule: '<cron expression>', run: async () => {} }.
const heartbeat = { schedule: '* * * * *', run: () => logger.info('Heartbeat: server is running.') };

const start = () => {
    const jobs = [heartbeat, ...modules.flatMap((m) => (m.jobs ? m.jobs() : []))];
    for (const job of jobs) {
        cron.schedule(job.schedule, () => {
            Promise.resolve(job.run()).catch((error) => logger.error('Scheduled job failed', error));
        });
    }
};

module.exports = { start };
