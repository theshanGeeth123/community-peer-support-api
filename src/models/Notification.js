import mongoose from "mongoose";

import { NOTIFICATION_TYPE } from "../constants/notification.constants.js";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
    },

    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      required: [true, "Notification type is required"],
    },

    /*
     * The most recent person who triggered this notification.
     */
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Actor is required"],
    },

    /*
     * Everyone this notification represents. Likes on the same post
     * are grouped into one unread notification ("Sarah and 2 others
     * supported your post"). A set, so like → unlike → like never
     * counts the same person twice.
     */
    actors: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Post is required"],
    },

    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportGroup",
      required: [true, "Support group is required"],
    },

    /*
     * The comment or reply that triggered it. The text is read live
     * when listing, so a comment removed by a moderator never shows
     * up in someone's notifications.
     */
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PostComment",
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

notificationSchema.index({ recipient: 1, updatedAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, post: 1, type: 1, isRead: 1 });
notificationSchema.index({ post: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
