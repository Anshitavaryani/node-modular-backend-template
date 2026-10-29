// Who is calling, from the x-access-token header.
//   authenticate       user token: sets req.user (a User instance with user_profile) and req.tokenDoc; 401 otherwise
//   optionalAuth       as authenticate, but a missing or invalid token leaves req.user null
//   authenticateAdmin  admin token: sets req.admin (the Admin row); 401 otherwise
//   requireRole(...)   401 unless the caller's role abbreviation (req.admin, else req.user) is listed
const jwt = require("jsonwebtoken");
const config = require("../../core/config/config");
const catchAsync = require("../../core/http/catchAsync");
const ApiError = require("../../core/http/ApiError");
const httpStatus = require("../../core/http/status");
const { User, UserToken, Profile, Admin, Role } = require("../../models");
const { TOKEN_TYPE, ACCESS_TOKEN_HEADER } = require("./constants");
const { passwordStamp } = require("./token.service");

const unauthorized = (message) => new ApiError(httpStatus.UNAUTHORIZED, message);

const verifySignedToken = (token, invalidMessage) => {
  try {
    return jwt.verify(token, config.jwt.secret, { algorithms: ["HS256"] });
  } catch (error) {
    throw unauthorized(
      error.name === "TokenExpiredError" ? "Token has expired. Please log in again." : invalidMessage
    );
  }
};

const userFromToken = async (token) => {
  const payload = verifySignedToken(token, "Invalid Token");
  const tokenDoc = await UserToken.findOne({
    where: {
      token,
      role_id: payload.role_id,
      token_type: TOKEN_TYPE.ACCESS,
      user_id: payload.sub,
      is_active: true,
    },
  });
  if (!tokenDoc) throw unauthorized("Token Not Found");

  const user = await User.findOne({
    where: { id: tokenDoc.user_id, is_active: true, role_id: payload.role_id },
    include: [
      {
        model: Profile,
        as: "user_profile",
        attributes: ["name", "dialing_code", "mobile", "is_active", "created_at"],
      },
    ],
  });
  if (!user) throw unauthorized("User Not Found");
  return { user, tokenDoc };
};

const authenticate = catchAsync(async (req, res, next) => {
  const token = req.headers[ACCESS_TOKEN_HEADER];
  if (!token) throw unauthorized("Please authenticate");
  const { user, tokenDoc } = await userFromToken(token);
  req.user = user;
  req.tokenDoc = tokenDoc;
  next();
});

const optionalAuth = catchAsync(async (req, res, next) => {
  req.user = null;
  req.tokenDoc = null;
  const token = req.headers[ACCESS_TOKEN_HEADER];
  if (token) {
    try {
      const { user, tokenDoc } = await userFromToken(token);
      req.user = user;
      req.tokenDoc = tokenDoc;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
  }
  next();
});

const authenticateAdmin = catchAsync(async (req, res, next) => {
  const token = req.headers[ACCESS_TOKEN_HEADER];
  if (!token) throw unauthorized("Access denied: No token provided");
  const payload = verifySignedToken(token, "Invalid token.");
  // Only an admin sign-in token passes here: a user token or a password-reset token is refused.
  if (payload.scope !== "admin") throw unauthorized("Invalid token.");
  const admin = await Admin.findOne({ where: { id: payload.sub, is_active: true } });
  if (!admin) throw unauthorized("Account no longer exists or is inactive.");
  // A token signed before the admin's last password change is no longer valid.
  if (payload.pwd !== passwordStamp(admin.password)) throw unauthorized("Token has expired. Please log in again.");
  req.admin = admin;
  next();
});

const requireRole = (...abbreviations) =>
  catchAsync(async (req, res, next) => {
    const roleId = (req.admin || req.user)?.role_id;
    const role = roleId ? await Role.findByPk(roleId) : null;
    if (!role || !abbreviations.includes(role.abbreviation)) {
      throw unauthorized("You are not authorized to access this api");
    }
    next();
  });

module.exports = { authenticate, optionalAuth, authenticateAdmin, requireRole };
