// Longest real address (RFC 5321); longer input is refused before it reaches the regex, as in the starter.
const MAX_EMAIL_LENGTH = 254;

const validateEmail = (email) => {
    const str = String(email).toLowerCase();
    if (str.length > MAX_EMAIL_LENGTH) return null;
    return str.match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

module.exports = validateEmail;
