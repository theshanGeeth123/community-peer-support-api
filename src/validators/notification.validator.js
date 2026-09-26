import { param, query } from "express-validator";

export const listNotificationsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .bail()
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .bail()
    .toInt(),

  query("unreadOnly")
    .optional()
    .isBoolean()
    .withMessage("unreadOnly must be true or false")
    .bail()
    .toBoolean(),
];

export const notificationIdParamValidator = [
  param("notificationId")
    .isMongoId()
    .withMessage("Invalid notification ID"),
];
