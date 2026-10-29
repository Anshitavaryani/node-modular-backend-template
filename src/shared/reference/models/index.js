// The shared/reference module's tables.
const Country = require('./country.model');
const State = require('./state.model');
const City = require('./city.model');
const Timezone = require('./timezone.model');
const Category = require('./category.model');
const Role = require('./role.model');
const Department = require('./department.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's models are
// loaded (src/models.js), with all of them by name. Role and Department links to admins and users belong to identity.
const associate = () => {
    Country.hasMany(State, { foreignKey: 'country_id', as: 'all_state' });
    State.belongsTo(Country, { foreignKey: 'country_id', as: 'country' });

    Country.hasMany(City, { foreignKey: 'country_id', as: 'all_city' });
    City.belongsTo(Country, { foreignKey: 'country_id', as: 'country' });

    State.hasMany(City, { foreignKey: 'state_id', as: 'all_city' });
    City.belongsTo(State, { foreignKey: 'state_id', as: 'state' });
};

module.exports = { models: { Country, State, City, Timezone, Category, Role, Department }, associate };
