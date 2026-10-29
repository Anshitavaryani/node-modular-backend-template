// Access tokens: a signed JWT plus a user_tokens row, so logout and password change can revoke them.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../../core/config/config");
const ApiError = require("../../core/http/ApiError");
const httpStatus = require("../../core/http/status");
const { UserToken } = require("../../models");
const { TOKEN_TYPE } = require("./constants");

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// Random token for a verified forgot-password OTP (stored in otps.code).
const randomToken = (length) =>
  Array.from({ length }, () => CHARSET[crypto.randomInt(CHARSET.length)]).join("");

// jti makes every token unique: without it, two tokens for one user in the same second are identical, so ending one
// session (logout, password change) would leave the other row, and the same token, working.
const generateToken = (userId, expires, type, roleId) =>
  jwt.sign(
    {
      jti: crypto.randomUUID(),
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(expires.getTime() / 1000),
      type,
      role_id: roleId,
    },
    config.jwt.secret
  );

const saveToken = (token, userId, expires, type, roleId) =>
  UserToken.create({
    user_id: userId,
    token_type: type,
    token,
    expired_at: expires,
    role_id: roleId,
  });

const verifyToken = async (token, type) => {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ["HS256"] });
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Token has expired. Please log in again."
        : "Invalid Token";
    throw new ApiError(httpStatus.UNAUTHORIZED, message);
  }
  const tokenDoc = await UserToken.findOne({
    where: { token, token_type: type, user_id: payload.sub },
  });
  if (!tokenDoc) throw new ApiError(httpStatus.NOT_FOUND, "Token not found");
  if (tokenDoc.expired_at < new Date()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Token is expired. Please log in again.");
  }
  return tokenDoc;
};

// A short HMAC of an admin's password hash, carried in the admin's tokens. Changing the password changes it, so every
// token signed before the change stops working (admin tokens are not stored, so they cannot be deleted instead).
const passwordStamp = (passwordHash) =>
  crypto.createHmac("sha256", config.jwt.secret).update(String(passwordHash)).digest("base64url").slice(0, 16);

const generateAuthTokens = async (user) => {
  const expires = new Date(Date.now() + config.jwt.accessTokenMinutes * 60 * 1000);
  const accessToken = generateToken(user.id, expires, TOKEN_TYPE.ACCESS, user.role_id);
  const tokenDoc = await saveToken(accessToken, user.id, expires, TOKEN_TYPE.ACCESS, user.role_id);
  return {
    access: { id: tokenDoc.id, token: accessToken, expires },
    refresh: { id: "", token: "", expires: "" },
  };
};

module.exports = {
  randomToken,
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  passwordStamp,
};
