import mongoose from "mongoose";

const authSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revocationReason: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    createdByIp: {
      type: String,
      trim: true,
      default: null,
    },

    lastUsedIp: {
      type: String,
      trim: true,
      default: null,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

authSessionSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    name: "expire_auth_sessions",
  }
);

authSessionSchema.index(
  {
    user: 1,
    revokedAt: 1,
  },
  {
    name: "user_active_sessions",
  }
);

const AuthSession = mongoose.model(
  "AuthSession",
  authSessionSchema
);

export default AuthSession;