import mongoose from "mongoose";

import {
  JOIN_REQUEST_STATUS,
} from "../constants/group.constants.js";

const groupJoinRequestSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportGroup",

      required: [
        true,
        "Support group is required",
      ],

      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",

      required: [
        true,
        "User is required",
      ],

      index: true,
    },

    reason: {
      type: String,

      required: [
        true,
        "Join request reason is required",
      ],

      trim: true,

      minlength: [
        10,
        "Join request reason must contain at least 10 characters",
      ],

      maxlength: [
        500,
        "Join request reason cannot exceed 500 characters",
      ],
    },

    status: {
      type: String,

      enum: Object.values(
        JOIN_REQUEST_STATUS
      ),

      default:
        JOIN_REQUEST_STATUS.PENDING,

      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewNote: {
      type: String,
      trim: true,

      maxlength: [
        500,
        "Review note cannot exceed 500 characters",
      ],

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

groupJoinRequestSchema.index({
  group: 1,
  status: 1,
  createdAt: -1,
});

groupJoinRequestSchema.index({
  user: 1,
  createdAt: -1,
});

groupJoinRequestSchema.index(
  {
    group: 1,
    user: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      status:
        JOIN_REQUEST_STATUS.PENDING,
    },

    name:
      "unique_pending_group_join_request",
  }
);

groupJoinRequestSchema.methods.toSafeObject =
  function () {
    return {
      id: this._id.toString(),

      group: this.group,

      user: this.user,

      reason: this.reason,

      status: this.status,

      reviewedBy:
        this.reviewedBy,

      reviewNote:
        this.reviewNote,

      reviewedAt:
        this.reviewedAt,

      createdAt:
        this.createdAt,

      updatedAt:
        this.updatedAt,
    };
  };

const GroupJoinRequest =
  mongoose.model(
    "GroupJoinRequest",
    groupJoinRequestSchema
  );

export default GroupJoinRequest;