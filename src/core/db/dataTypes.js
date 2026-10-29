// Column types the models share, beyond Sequelize's own.
const { DataTypes } = require('@sequelize/core');

// BIGINT that reads back as a number. Sequelize 7 returns BIGINT values as strings (and the MariaDB driver gives a new
// row's id as a BigInt), to keep integers beyond 2^53 exact; the API has always returned ids as numbers, and ids stay
// far below that. A value beyond it becomes a string, which JSON can carry.
// Use it for BIGINT ids and the columns that point at them.
class NumericBigInt extends DataTypes.BIGINT {
    sanitize(value) {
        const sanitized = super.sanitize(value);
        if (typeof sanitized !== 'string' && typeof sanitized !== 'bigint') return sanitized;
        const number = Number(sanitized);
        return Number.isSafeInteger(number) ? number : String(sanitized);
    }
}

module.exports = { NumericBigInt };
