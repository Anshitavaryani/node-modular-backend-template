const passwordValidator = require("password-validator");

// bcrypt only uses the first 72 bytes of its input, so longer passwords are refused rather than silently truncated.
const MAX_BCRYPT_BYTES = 72;

const schema = new passwordValidator();
schema
  .is()
  .min(8)
  .is()
  .max(MAX_BCRYPT_BYTES)
  .has()
  .digits(2)
  .has()
  .not()
  .spaces();
schema.is().not().oneOf(["Passw0rd", "Password123"]);

const validatePassword = (pass) => {
  if (typeof pass !== "string") return false;
  if (Buffer.byteLength(pass, "utf8") > MAX_BCRYPT_BYTES) return false;
  return schema.validate(pass);
};

module.exports = validatePassword;
