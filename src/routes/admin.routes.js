import express from "express";

import {
  getUserById,
  getUsers,
  revokeAllUserSessions,
  updateUserRole,
  updateUserStatus,
} from "../controllers/adminUser.controller.js";

import {
  USER_ROLES,
} from "../constants/auth.constants.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  listUsersValidator,
  updateUserRoleValidator,
  updateUserStatusValidator,
  userIdValidator,
} from "../validators/admin.validator.js";

const router = express.Router();

router.use(
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN)
);

router.get(
  "/users",
  listUsersValidator,
  validateRequest,
  getUsers
);

router.get(
  "/users/:userId",
  userIdValidator,
  validateRequest,
  getUserById
);

router.patch(
  "/users/:userId/role",
  updateUserRoleValidator,
  validateRequest,
  updateUserRole
);

router.patch(
  "/users/:userId/status",
  updateUserStatusValidator,
  validateRequest,
  updateUserStatus
);

router.post(
  "/users/:userId/revoke-sessions",
  userIdValidator,
  validateRequest,
  revokeAllUserSessions
);

export default router;