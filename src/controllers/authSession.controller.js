import mongoose from "mongoose";

import {
  ACCOUNT_STATUS,
} from "../constants/auth.constants.js";

import AuthSession from "../models/AuthSession.js";
import User from "../models/User.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

import {
  createAuthenticationToken,
} from "../utils/jwt.util.js";

import {
  hashToken,
} from "../utils/token.util.js";

const getClientMetadata = (req) => ({
  ipAddress: req.ip || null,

  userAgent:
    req.get("user-agent")?.slice(0, 500) ||
    null,
});

const validateUserCanAuthenticate = (user) => {
  if (!user.isEmailVerified) {
    throw new AppError(
      "Please verify your email address before logging in",
      403
    );
  }

  if (
    user.accountStatus ===
    ACCOUNT_STATUS.SUSPENDED
  ) {
    throw new AppError(
      "This account has been suspended",
      403
    );
  }

  if (
    user.accountStatus ===
    ACCOUNT_STATUS.DEACTIVATED
  ) {
    throw new AppError(
      "This account has been deactivated",
      403
    );
  }

  if (
    user.accountStatus !==
    ACCOUNT_STATUS.ACTIVE
  ) {
    throw new AppError(
      "This account is not active",
      403
    );
  }
};

export const loginUser = asyncHandler(
  async (req, res) => {
    const { email, password } = req.body;

    const normalizedEmail =
      email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    const isPasswordCorrect =
      user &&
      (await user.comparePassword(password));

    if (!user || !isPasswordCorrect) {
      throw new AppError(
        "Invalid email address or password",
        401
      );
    }

    validateUserCanAuthenticate(user);

    const sessionId =
      new mongoose.Types.ObjectId();

    const authenticationToken =
      createAuthenticationToken({
        user,
        sessionId,
      });

    const sessionExpiresAt = new Date(
      Date.now() +
        authenticationToken.expiresInSeconds *
          1000
    );

    const clientMetadata =
      getClientMetadata(req);

    await AuthSession.create({
      _id: sessionId,
      user: user._id,

      tokenHash: hashToken(
        authenticationToken.token
      ),

      expiresAt: sessionExpiresAt,

      userAgent: clientMetadata.userAgent,
      createdByIp: clientMetadata.ipAddress,
      lastUsedIp: clientMetadata.ipAddress,
      lastUsedAt: new Date(),
    });

    user.lastLoginAt = new Date();

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: user.toSafeObject(),

        token: authenticationToken.token,
        tokenType:
          authenticationToken.tokenType,
        expiresInSeconds:
          authenticationToken.expiresInSeconds,
      },
    });
  }
);

export const logoutUser = asyncHandler(
  async (req, res) => {
    await AuthSession.findOneAndUpdate(
      {
        _id: req.auth.sessionId,
        user: req.user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          revocationReason: "USER_LOGOUT",
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Logout successful.",
    });
  }
);

export const getCurrentUser = asyncHandler(
  async (req, res) => {
    return res.status(200).json({
      success: true,
      message:
        "Current user retrieved successfully.",
      data: {
        user: req.user.toSafeObject(),
      },
    });
  }
);