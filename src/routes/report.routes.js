import express from "express";

import {
  submitReport,
  getReports,
  getReportById,
  reviewReport,
} from "../controllers/report.controller.js";

import { USER_ROLES } from "../constants/auth.constants.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  submitReportValidator,
  listReportsValidator,
  reportIdValidator,
  reviewReportValidator,
} from "../validators/report.validator.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ─── User routes ──────────────────────────────────────────────────────────────

router.post(
  "/",
  submitReportValidator,
  validateRequest,
  submitReport
);

// ─── Moderator / Admin routes ─────────────────────────────────────────────────

router.get(
  "/",
  authorizeRoles(USER_ROLES.MODERATOR, USER_ROLES.ADMIN),
  listReportsValidator,
  validateRequest,
  getReports
);

router.get(
  "/:reportId",
  authorizeRoles(USER_ROLES.MODERATOR, USER_ROLES.ADMIN),
  reportIdValidator,
  validateRequest,
  getReportById
);

router.post(
  "/:reportId/review",
  authorizeRoles(USER_ROLES.MODERATOR, USER_ROLES.ADMIN),
  reviewReportValidator,
  validateRequest,
  reviewReport
);

export default router;
