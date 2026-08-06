import AuthSession from "../models/AuthSession.js";
import User from "../models/User.js";

import {
  AUTH_PROVIDERS,
} from "../constants/auth.constants.js";

import {
  sendPasswordResetOtp,
} from "../services/email.service.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

import {
  generateSixDigitOtp,
  hashToken,
  securelyCompareToken,
} from "../utils/token.util.js";

const getIntegerEnvironmentValue = ({
  variableName,
  defaultValue,
  minimum,
  maximum,
}) => {
  const value = Number(
    process.env[variableName] || defaultValue
  );

  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new AppError(
      `${variableName} configuration is invalid`,
      500
    );
  }

  return value;
};

const clearPasswordResetOtp = (user) => {
  user.passwordResetOtpHash = null;
  user.passwordResetOtpExpiresAt = null;
  user.passwordResetOtpSentAt = null;
  user.passwordResetOtpAttemptCount = 0;
};

const getGenericForgotPasswordResponse = () => ({
  success: true,
  message:
    "If an eligible account exists for this email address, a password reset code will be sent.",
});

export const forgotPassword = asyncHandler(
  async (req, res) => {
    const { email } = req.body;

    const normalizedEmail =
      email.trim().toLowerCase();

    const otpExpiresInMinutes =
      getIntegerEnvironmentValue({
        variableName:
          "PASSWORD_RESET_OTP_EXPIRES_MINUTES",
        defaultValue: 10,
        minimum: 1,
        maximum: 60,
      });

    const resendCooldownSeconds =
      getIntegerEnvironmentValue({
        variableName:
          "PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS",
        defaultValue: 60,
        minimum: 30,
        maximum: 3600,
      });

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      [
        "+passwordResetOtpHash",
        "+passwordResetOtpExpiresAt",
        "+passwordResetOtpSentAt",
        "+passwordResetOtpAttemptCount",
      ].join(" ")
    );

    /*
     * Return the same response when an account does not exist
     * or its email is not verified.
     */
    if (!user || !user.isEmailVerified) {
      return res
        .status(200)
        .json(getGenericForgotPasswordResponse());
    }

    const currentTime = new Date();

    if (user.passwordResetOtpSentAt) {
      const elapsedMilliseconds =
        currentTime.getTime() -
        user.passwordResetOtpSentAt.getTime();

      const cooldownMilliseconds =
        resendCooldownSeconds * 1000;

      /*
       * Use the same generic response during the cooldown.
       * Do not send another OTP.
       */
      if (
        elapsedMilliseconds <
        cooldownMilliseconds
      ) {
        return res
          .status(200)
          .json(getGenericForgotPasswordResponse());
      }
    }

    const otp = generateSixDigitOtp();

    user.passwordResetOtpHash =
      hashToken(otp);

    user.passwordResetOtpExpiresAt =
      new Date(
        currentTime.getTime() +
          otpExpiresInMinutes * 60 * 1000
      );

    user.passwordResetOtpSentAt =
      currentTime;

    user.passwordResetOtpAttemptCount = 0;

    await user.save({
      validateBeforeSave: false,
    });

    try {
      await sendPasswordResetOtp({
        recipientEmail: user.email,
        otp,
        expiresInMinutes:
          otpExpiresInMinutes,
      });
    } catch (error) {
      console.error(
        "Password reset email delivery failed:",
        error.message
      );

      clearPasswordResetOtp(user);

      await user.save({
        validateBeforeSave: false,
      });

      throw new AppError(
        "The password reset email could not be sent. Please try again later.",
        503
      );
    }

    return res
      .status(200)
      .json(getGenericForgotPasswordResponse());
  }
);

export const resetPassword = asyncHandler(
  async (req, res) => {
    const {
      email,
      otp,
      newPassword,
    } = req.body;

    const normalizedEmail =
      email.trim().toLowerCase();

    const maximumAttempts =
      getIntegerEnvironmentValue({
        variableName:
          "PASSWORD_RESET_OTP_MAX_ATTEMPTS",
        defaultValue: 5,
        minimum: 1,
        maximum: 10,
      });

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      [
        "+passwordResetOtpHash",
        "+passwordResetOtpExpiresAt",
        "+passwordResetOtpSentAt",
        "+passwordResetOtpAttemptCount",
      ].join(" ")
    );

    if (
      !user ||
      !user.isEmailVerified ||
      !user.passwordResetOtpHash ||
      !user.passwordResetOtpExpiresAt
    ) {
      throw new AppError(
        "Invalid or expired password reset code",
        400
      );
    }

    const currentTime = new Date();

    if (
      user.passwordResetOtpExpiresAt.getTime() <=
      currentTime.getTime()
    ) {
      clearPasswordResetOtp(user);

      await user.save({
        validateBeforeSave: false,
      });

      throw new AppError(
        "Password reset code has expired. Please request a new code.",
        400
      );
    }

    const currentAttemptCount =
      user.passwordResetOtpAttemptCount || 0;

    if (
      currentAttemptCount >= maximumAttempts
    ) {
      clearPasswordResetOtp(user);

      await user.save({
        validateBeforeSave: false,
      });

      throw new AppError(
        "Maximum password reset attempts exceeded. Please request a new code.",
        429
      );
    }

    const isOtpCorrect =
      securelyCompareToken(
        otp,
        user.passwordResetOtpHash
      );

    if (!isOtpCorrect) {
      user.passwordResetOtpAttemptCount =
        currentAttemptCount + 1;

      const remainingAttempts =
        maximumAttempts -
        user.passwordResetOtpAttemptCount;

      if (remainingAttempts <= 0) {
        clearPasswordResetOtp(user);

        await user.save({
          validateBeforeSave: false,
        });

        throw new AppError(
          "Maximum password reset attempts exceeded. Please request a new code.",
          429
        );
      }

      await user.save({
        validateBeforeSave: false,
      });

      throw new AppError(
        `Invalid password reset code. ${remainingAttempts} attempt${
          remainingAttempts === 1 ? "" : "s"
        } remaining.`,
        400
      );
    }

    /*
     * The existing User model pre-save middleware
     * automatically hashes this password.
     */
    user.password = newPassword;

    /*
     * This also allows a future Google-created user
     * to add an email/password login method.
     */
    if (
      !user.authProviders.includes(
        AUTH_PROVIDERS.LOCAL
      )
    ) {
      user.authProviders.push(
        AUTH_PROVIDERS.LOCAL
      );
    }

    clearPasswordResetOtp(user);

    await user.save();

    /*
     * Logout the user from every currently active
     * device after a password reset.
     */
    await AuthSession.updateMany(
      {
        user: user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          revocationReason:
            "PASSWORD_RESET",
        },
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. Please log in using your new password.",
    });
  }
);