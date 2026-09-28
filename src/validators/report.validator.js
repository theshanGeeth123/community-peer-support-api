import { body, param, query } from "express-validator";

import {
  MODERATION_ACTION_TYPE,
  REPORT_REASON,
  REPORT_STATUS,
  REPORT_TARGET_TYPE,
} from "../constants/moderation.constants.js";

// ─── Shared ──────────────────────────────────────────────────────────────────

export const reportIdValidator = [
  param("reportId")
    .isMongoId()
    .withMessage("Invalid report ID"),
];

// ─── POST /reports ────────────────────────────────────────────────────────────

export const submitReportValidator = [
  body("group")
    .notEmpty()
    .withMessage("Group ID is required")
    .bail()
    .isMongoId()
    .withMessage("Invalid group ID"),

  body("targetType")
    .notEmpty()
    .withMessage("Target type is required")
    .bail()
    .isIn(Object.values(REPORT_TARGET_TYPE))
    .withMessage(
      `Target type must be one of: ${Object.values(REPORT_TARGET_TYPE).join(", ")}`
    ),

  body("targetId")
    .notEmpty()
    .withMessage("Target ID is required")
    .bail()
    .isMongoId()
    .withMessage("Invalid target ID"),

  body("reason")
    .notEmpty()
    .withMessage("Report reason is required")
    .bail()
    .isIn(Object.values(REPORT_REASON))
    .withMessage(
      `Reason must be one of: ${Object.values(REPORT_REASON).join(", ")}`
    ),

  body("additionalDetails")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Additional details cannot exceed 500 characters"),
];

// ─── GET /reports ─────────────────────────────────────────────────────────────

export const listReportsValidator = [
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

  query("status")
    .optional()
    .isIn(Object.values(REPORT_STATUS))
    .withMessage(
      `Status must be one of: ${Object.values(REPORT_STATUS).join(", ")}`
    ),

  query("group")
    .optional()
    .isMongoId()
    .withMessage("Invalid group ID"),

  query("targetType")
    .optional()
    .isIn(Object.values(REPORT_TARGET_TYPE))
    .withMessage(
      `Target type must be one of: ${Object.values(REPORT_TARGET_TYPE).join(", ")}`
    ),
];

// ─── POST /reports/:reportId/review ──────────────────────────────────────────

export const reviewReportValidator = [
  ...reportIdValidator,

  body("action")
    .notEmpty()
    .withMessage("Moderation action is required")
    .bail()
    .isIn(Object.values(MODERATION_ACTION_TYPE))
    .withMessage(
      `Action must be one of: ${Object.values(MODERATION_ACTION_TYPE).join(", ")}`
    ),

  body("reason")
    .notEmpty()
    .withMessage("Reason for action is required")
    .bail()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage("Reason must be between 5 and 500 characters"),
];
