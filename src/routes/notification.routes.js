import express from "express";

import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  listNotificationsValidator,
  notificationIdParamValidator,
} from "../validators/notification.validator.js";

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  listNotificationsValidator,
  validateRequest,
  getMyNotifications
);

router.get("/unread-count", getUnreadNotificationCount);

/*
 * Keep before "/:notificationId/read".
 */
router.patch("/read-all", markAllNotificationsRead);

router.patch(
  "/:notificationId/read",
  notificationIdParamValidator,
  validateRequest,
  markNotificationRead
);

export default router;
