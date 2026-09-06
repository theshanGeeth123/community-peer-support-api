import mongoose from "mongoose";

import {
  GROUP_MEMBERSHIP_STATUS,
} from "../constants/group.constants.js";

const groupMembershipSchema = new mongoose.Schema(
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

    status: {
      type: String,

      enum: Object.values(
        GROUP_MEMBERSHIP_STATUS
      ),

      default:
        GROUP_MEMBERSHIP_STATUS.ACTIVE,

      index: true,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    suspendedAt: {
      type: Date,
      default: null,
    },

    removedAt: {
      type: Date,
      default: null,
    },

    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    statusReason: {
      type: String,
      trim: true,

      maxlength: [
        500,
        "Membership status reason cannot exceed 500 characters",
      ],

      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

groupMembershipSchema.index(
  {
    group: 1,
    user: 1,
  },
  {
    unique: true,

    name:
      "unique_group_membership",
  }
);

groupMembershipSchema.index({
  user: 1,
  status: 1,
  createdAt: -1,
});

groupMembershipSchema.index({
  group: 1,
  status: 1,
  createdAt: -1,
});

groupMembershipSchema.methods.toSafeObject =
  function () {
    return {
      id: this._id.toString(),

      group: this.group,

      user: this.user,

      status: this.status,

      joinedAt:
        this.joinedAt,

      suspendedAt:
        this.suspendedAt,

      removedAt:
        this.removedAt,

      lastUpdatedBy:
        this.lastUpdatedBy,

      statusReason:
        this.statusReason,

      createdAt:
        this.createdAt,

      updatedAt:
        this.updatedAt,
    };
  };

const GroupMembership =
  mongoose.model(
    "GroupMembership",
    groupMembershipSchema
  );

export default GroupMembership;