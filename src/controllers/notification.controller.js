import Notification from "../models/Notification.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const PREVIEW_LENGTH = 100;

const toPreview = (text) => {
  if (typeof text !== "string") {
    return null;
  }

  const singleLine = text.replace(/\s+/g, " ").trim();

  return singleLine.length > PREVIEW_LENGTH
    ? `${singleLine.slice(0, PREVIEW_LENGTH).trimEnd()}…`
    : singleLine;
};

const formatNotification = (notification) => ({
  id: notification._id.toString(),
  type: notification.type,
  isRead: notification.isRead,

  actor: notification.actor
    ? {
        id: notification.actor._id.toString(),
        fullName: notification.actor.fullName,
        avatarUrl: notification.actor.avatarUrl ?? null,
      }
    : null,

  actorCount: Math.max(1, notification.actors?.length ?? 1),

  group: notification.group
    ? {
        id: notification.group._id.toString(),
        name: notification.group.name,
      }
    : null,

  /*
   * null when the post or comment has since been deleted,
   * or removed by a moderator.
   */
  post:
    notification.post && !notification.post.isRemoved
      ? {
          id: notification.post._id.toString(),
          preview: toPreview(notification.post.content),
        }
      : null,

  comment:
    notification.comment && !notification.comment.isRemoved
      ? {
          id: notification.comment._id.toString(),
          preview: toPreview(notification.comment.content),
        }
      : null,

  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

/*
|--------------------------------------------------------------------------
| LIST MY NOTIFICATIONS
|--------------------------------------------------------------------------
*/

export const getMyNotifications = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const skip = (page - 1) * limit;

  const filter = { recipient: req.user._id };

  if (req.query.unreadOnly === true) {
    filter.isRead = false;
  }

  const [notifications, totalNotifications, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "actor", select: "fullName avatarUrl" })
      .populate({ path: "group", select: "name" })
      .populate({ path: "post", select: "content isRemoved" })
      .populate({ path: "comment", select: "content isRemoved" }),

    Notification.countDocuments(filter),

    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalNotifications / limit));

  return res.status(200).json({
    success: true,
    message: "Notifications retrieved successfully",
    data: {
      notifications: notifications.map(formatNotification),
      unreadCount,

      pagination: {
        page,
        limit,
        totalNotifications,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    },
  });
});

/*
|--------------------------------------------------------------------------
| UNREAD COUNT (for the bell badge)
|--------------------------------------------------------------------------
*/

export const getUnreadNotificationCount = asyncHandler(async (req, res) => {
  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  return res.status(200).json({
    success: true,
    message: "Unread count retrieved successfully",
    data: { unreadCount },
  });
});

/*
|--------------------------------------------------------------------------
| MARK ONE AS READ
|--------------------------------------------------------------------------
*/

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: req.params.notificationId,
      recipient: req.user._id,
    },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    throw new AppError("Notification was not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: { id: notification._id.toString(), isRead: true },
  });
});

/*
|--------------------------------------------------------------------------
| MARK ALL AS READ
|--------------------------------------------------------------------------
*/

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  return res.status(200).json({
    success: true,
    message: "All notifications marked as read",
    data: { updatedCount: result.modifiedCount },
  });
});
