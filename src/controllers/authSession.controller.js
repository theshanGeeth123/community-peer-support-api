import AuthSession from "../models/AuthSession.js";
import User from "../models/User.js";

import {
  validateUserCanAuthenticate,
} from "../services/authAccount.service.js";

import {
  createAuthenticationSession,
} from "../services/authSession.service.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

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

    const authenticationToken =
      await createAuthenticationSession({
        user,
        request: req,
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