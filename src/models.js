// Every table, loaded once: each module defines its own models (<module>/models) and the associations it owns.
// require('<...>/models') returns all models by name.
const modules = [
    require('./shared/identity/models'),
    require('./shared/reference/models'),
    require('./shared/content/models'),
    require('./shared/contact/models'),
    require('./shared/billing/models'),
];

const models = Object.assign({}, ...modules.map((m) => m.models));
// Associations need both sides loaded, so they run after every module's models exist.
for (const m of modules) m.associate(models);

module.exports = models;
