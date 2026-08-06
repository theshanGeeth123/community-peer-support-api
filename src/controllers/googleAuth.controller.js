import {
  AUTH_PROVIDERS,
} from "../constants/auth.constants.js";

import User from "../models/User.js";

import {
  validateUserCanAuthenticate,
} from "../services/authAccount.service.js";

import {
  createAuthenticationSession,
} from "../services/authSession.service.js";

import {
  verifyGoogleIdToken,
} from "../services/googleAuth.service.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const loginWithGoogle = asyncHandler(
  async (req, res) => {
    const { idToken } = req.body;

    const googleProfile =
      await verifyGoogleIdToken(idToken);

    const {
      googleId,
      email,
      fullName,
      avatarUrl,
    } = googleProfile;

    const [userByGoogleId, userByEmail] =
      await Promise.all([
        User.findOne({
          googleId,
        }).select("+googleId"),

        User.findOne({
          email,
        }).select("+googleId"),
      ]);

    /*
     * This protects against a rare situation where
     * the Google ID and email point to two different
     * accounts in our database.
     */
    if (
      userByGoogleId &&
      userByEmail &&
      userByGoogleId._id.toString() !==
        userByEmail._id.toString()
    ) {
      throw new AppError(
        "This Google account cannot be linked automatically. Please contact support.",
        409
      );
    }

    let user =
      userByGoogleId || userByEmail;

    const isNewUser = !user;

    if (!user) {
      user = new User({
        fullName,
        email,
        googleId,

        avatarUrl,

        authProviders: [
          AUTH_PROVIDERS.GOOGLE,
        ],

        isEmailVerified: true,
      });
    } else {
      if (
        user.googleId &&
        user.googleId !== googleId
      ) {
        throw new AppError(
          "This email address is already connected to another Google account",
          409
        );
      }

      /*
       * The stable Google identifier is stored
       * as googleId.
       */
      user.googleId = googleId;

      /*
       * Google may update an account's email.
       * Update it only after verifying the token.
       */
      if (
        userByGoogleId &&
        user.email !== email
      ) {
        user.email = email;
      }

      user.isEmailVerified = true;

      if (
        !user.authProviders.includes(
          AUTH_PROVIDERS.GOOGLE
        )
      ) {
        user.authProviders.push(
          AUTH_PROVIDERS.GOOGLE
        );
      }

      /*
       * Preserve a profile name or image that the
       * user has already customized.
       */
      if (!user.fullName && fullName) {
        user.fullName = fullName;
      }

      if (!user.avatarUrl && avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
    }

    await user.save();

    validateUserCanAuthenticate(user);

    const authenticationToken =
      await createAuthenticationSession({
        user,
        request: req,
      });

    return res.status(200).json({
      success: true,

      message: isNewUser
        ? "Google account registered and logged in successfully."
        : "Google login successful.",

      data: {
        isNewUser,

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