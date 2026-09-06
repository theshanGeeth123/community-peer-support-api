import mongoose from "mongoose";

import {
  GROUP_STATUS,
} from "../constants/group.constants.js";

const supportGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [
        true,
        "Group name is required",
      ],
      trim: true,
      minlength: [
        3,
        "Group name must contain at least 3 characters",
      ],
      maxlength: [
        100,
        "Group name cannot exceed 100 characters",
      ],
    },

    description: {
      type: String,
      required: [
        true,
        "Group description is required",
      ],
      trim: true,
      minlength: [
        10,
        "Group description must contain at least 10 characters",
      ],
      maxlength: [
        1000,
        "Group description cannot exceed 1000 characters",
      ],
    },

    category: {
      type: String,
      required: [
        true,
        "Group category is required",
      ],
      trim: true,
      minlength: [
        2,
        "Group category must contain at least 2 characters",
      ],
      maxlength: [
        80,
        "Group category cannot exceed 80 characters",
      ],
    },

    communityLocation: {
      type: String,
      trim: true,
      maxlength: [
        120,
        "Community location cannot exceed 120 characters",
      ],
      default: null,
    },

    rules: {
      type: [
        {
          type: String,
          trim: true,
          minlength: 3,
          maxlength: 300,
        },
      ],
      default: [],
    },

    peerSupporters: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    moderators: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    status: {
      type: String,
      enum: Object.values(
        GROUP_STATUS
      ),
      default:
        GROUP_STATUS.ACTIVE,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [
        true,
        "Group creator is required",
      ],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

supportGroupSchema.index(
  {
    name: 1,
  },
  {
    unique: true,
    name: "unique_support_group_name",
    collation: {
      locale: "en",
      strength: 2,
    },
  }
);

supportGroupSchema.index({
  status: 1,
  createdAt: -1,
});

supportGroupSchema.index({
  peerSupporters: 1,
});

supportGroupSchema.index({
  moderators: 1,
});

supportGroupSchema.methods.toSafeObject =
  function () {
    return {
      id: this._id.toString(),

      name:
        this.name,

      description:
        this.description,

      category:
        this.category,

      communityLocation:
        this.communityLocation,

      rules:
        this.rules,

      peerSupporters:
        this.peerSupporters,

      moderators:
        this.moderators,

      status:
        this.status,

      createdBy:
        this.createdBy,

      createdAt:
        this.createdAt,

      updatedAt:
        this.updatedAt,
    };
  };

const SupportGroup =
  mongoose.model(
    "SupportGroup",
    supportGroupSchema
  );

export default SupportGroup;