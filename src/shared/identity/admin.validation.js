// Request checks for the admin auth routes.
const httpStatus = require("../../core/http/status");
const ApiError = require("../../core/http/ApiError");
const catchAsync = require("../../core/http/catchAsync");
const validateEmail = require("../../core/utils/validateEmail");
const config = require("../../core/config/config");
const { Admin, Role, Department } = require("../../models");

const badRequest = (message) => new ApiError(httpStatus.BAD_REQUEST, message);

const validateCreateAdminBody = catchAsync(async (req, res, next) => {
  const { name, email, password, role_id, department_id } = req.body;
  if (!name || !email || !password || !role_id || !department_id) {
    throw badRequest(
      "Please Enter Required Fields : [name || email_id || password || role_id || department_id]"
    );
  }
  // Compared as strings: a JSON number 1 must not get past a check written against the env string "1".
  if (config.SUP_ADM_ROLE_ID && String(role_id) === String(config.SUP_ADM_ROLE_ID)) {
    throw badRequest("You are not authorized to create this role.");
  }
  if (!validateEmail(email)) throw badRequest("Invalid Name or Email");
  if (await Admin.isEmailTaken(email)) throw badRequest("Email already taken");

  const roleKey = Number(role_id);
  if (!Number.isInteger(roleKey) || !(await Role.findByPk(roleKey))) {
    throw badRequest("Invalid Role Id");
  }
  const departmentKey = Number(department_id);
  if (!Number.isInteger(departmentKey) || !(await Department.findByPk(departmentKey))) {
    throw badRequest("Invalid Department Id");
  }
  next();
});

const validateLoginAdminBody = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw badRequest("Please Enter Required Fields : [ email_id || password ]");
  }
  if (!validateEmail(email)) throw badRequest("Invalid Email");
  next();
});

module.exports = { validateCreateAdminBody, validateLoginAdminBody };
