import {
  body,
  param,
  query,
} from "express-validator";

import {
  ACCOUNT_STATUS,
  AUTH_PROVIDERS,
  USER_ROLES,
} from "../constants/auth.constants.js";

export const listUsersValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search value is too long"),

  query("role")
    .optional()
    .isIn(Object.values(USER_ROLES))
    .withMessage("Invalid user role"),

  query("status")
    .optional()
    .isIn(Object.values(ACCOUNT_STATUS))
    .withMessage("Invalid account status"),

  query("provider")
    .optional()
    .isIn(Object.values(AUTH_PROVIDERS))
    .withMessage("Invalid authentication provider"),
];

export const userIdValidator = [
  param("userId")
    .isMongoId()
    .withMessage("Invalid user ID"),
];

export const updateUserRoleValidator = [
  ...userIdValidator,

  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .bail()
    .isIn(Object.values(USER_ROLES))
    .withMessage("Invalid user role"),
];

export const updateUserStatusValidator = [
  ...userIdValidator,

  body("accountStatus")
    .notEmpty()
    .withMessage("Account status is required")
    .bail()
    .isIn(Object.values(ACCOUNT_STATUS))
    .withMessage("Invalid account status"),
];