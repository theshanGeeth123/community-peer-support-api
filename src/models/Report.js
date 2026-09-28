import mongoose from "mongoose";

import {
  REPORT_REASON,
  REPORT_STATUS,
  REPORT_TARGET_TYPE,
} from "../constants/moderation.constants.js";

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reporter is required"],
    },

    // TODO: update ref to "SupportGroup" once Friend 1's branch is merged
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportGroup",
      required: [true, "Group is required"],
    },

    targetType: {
      type: String,
      enum: Object.values(REPORT_TARGET_TYPE),
      required: [true, "Target type is required"],
    },

    // Generic ObjectId — ref will resolve to Post or Comment depending on targetType
    // TODO: validate targetId exists against the correct model after Post/Comment branches merge
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Target ID is required"],
    },

    reason: {
      type: String,
      enum: Object.values(REPORT_REASON),
      required: [true, "Report reason is required"],
    },

    additionalDetails: {
      type: String,
      trim: true,
      maxlength: [500, "Additional details cannot exceed 500 characters"],
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(REPORT_STATUS),
      default: REPORT_STATUS.PENDING,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

reportSchema.index({ group: 1, status: 1 });
reportSchema.index({ reporter: 1 });
reportSchema.index({ targetId: 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
