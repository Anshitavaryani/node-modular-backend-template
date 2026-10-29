// Every module, in mount order. Product folders: shared/ (used by every product), admin/ (the web admin app) and
// field/ (the field technician app). Order matters only where paths overlap: put the more specific path first.
module.exports = [
    require('./shared/identity'),
    require('./shared/reference'),
    require('./shared/content'),
    require('./shared/contact'),
    require('./shared/billing'),
];
