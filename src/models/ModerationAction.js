import mongoose from "mongoose";

import {
  MODERATION_ACTION_TYPE,
  REPORT_TARGET_TYPE,
} from "../constants/moderation.constants.js";

const moderationActionSchema = new mongoose.Schema(
  {
    moderator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Moderator is required"],
    },

    // TODO: update ref to "SupportGroup" once Friend 1's branch is merged
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportGroup",
      required: [true, "Group is required"],
    },

    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: [true, "Report reference is required"],
    },

    targetType: {
      type: String,
      enum: Object.values(REPORT_TARGET_TYPE),
      required: [true, "Target type is required"],
    },

    // Generic ObjectId — ref resolves to Post or Comment depending on targetType
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Target ID is required"],
    },

    action: {
      type: String,
      enum: Object.values(MODERATION_ACTION_TYPE),
      required: [true, "Moderation action is required"],
    },

    reason: {
      type: String,
      trim: true,
      required: [true, "Reason for action is required"],
      minlength: [5, "Reason must be at least 5 characters"],
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

moderationActionSchema.index({ moderator: 1, group: 1 });
moderationActionSchema.index({ group: 1 });
moderationActionSchema.index({ report: 1 });

const ModerationAction = mongoose.model(
  "ModerationAction",
  moderationActionSchema
);

export default ModerationAction;
