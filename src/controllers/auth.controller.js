import User from "../models/User.js";

import { AUTH_PROVIDERS } from "../constants/auth.constants.js";
import { sendEmailVerificationOtp } from "../services/email.service.js";
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

const clearEmailVerificationOtp = (
  user,
  { clearSentAt = true } = {}
) => {
  user.emailVerificationOtpHash = null;
  user.emailVerificationOtpExpiresAt = null;
  user.emailVerificationOtpAttemptCount = 0;

  if (clearSentAt) {
    user.emailVerificationOtpSentAt = null;
  }
};

export const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  const normalizedEmail = email.trim().toLowerCase();

  const otpExpiresInMinutes =
    getIntegerEnvironmentValue({
      variableName: "OTP_EXPIRES_MINUTES",
      defaultValue: 10,
      minimum: 1,
      maximum: 60,
    });

  let user = await User.findOne({
    email: normalizedEmail,
  });

  if (user?.isEmailVerified) {
    throw new AppError(
      "An account already exists with this email address",
      409
    );
  }

  const otp = generateSixDigitOtp();
  const currentTime = new Date();

  const otpExpiresAt = new Date(
    currentTime.getTime() +
      otpExpiresInMinutes * 60 * 1000
  );

  const isNewUser = !user;

  if (isNewUser) {
    user = new User({
      fullName,
      email: normalizedEmail,
      password,
      authProviders: [AUTH_PROVIDERS.LOCAL],
      isEmailVerified: false,
      emailVerificationOtpHash: hashToken(otp),
      emailVerificationOtpExpiresAt: otpExpiresAt,
      emailVerificationOtpSentAt: currentTime,
      emailVerificationOtpAttemptCount: 0,
    });
  } else {
    user.fullName = fullName;
    user.password = password;
    user.isEmailVerified = false;

    user.emailVerificationOtpHash = hashToken(otp);
    user.emailVerificationOtpExpiresAt = otpExpiresAt;
    user.emailVerificationOtpSentAt = currentTime;
    user.emailVerificationOtpAttemptCount = 0;

    if (
      !user.authProviders.includes(
        AUTH_PROVIDERS.LOCAL
      )
    ) {
      user.authProviders.push(AUTH_PROVIDERS.LOCAL);
    }
  }

  await user.save();

  try {
    await sendEmailVerificationOtp({
      recipientEmail: user.email,
      recipientName: user.fullName,
      otp,
      expiresInMinutes: otpExpiresInMinutes,
    });
  } catch (error) {
    console.error(
      "Verification email delivery failed:",
      error.message
    );

    throw new AppError(
      "Your account was created, but the verification email could not be sent. Please request a new code.",
      503
    );
  }

  res.status(isNewUser ? 201 : 200).json({
    success: true,
    message: isNewUser
      ? "Registration successful. A verification code has been sent to your email."
      : "A new verification code has been sent to your email.",
    data: {
      userId: user._id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      otpExpiresInMinutes,
    },
  });
});

export const verifyEmailOtp = asyncHandler(
  async (req, res) => {
    const { email, otp } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    const maximumAttempts =
      getIntegerEnvironmentValue({
        variableName: "OTP_MAX_ATTEMPTS",
        defaultValue: 5,
        minimum: 1,
        maximum: 10,
      });

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      [
        "+emailVerificationOtpHash",
        "+emailVerificationOtpExpiresAt",
        "+emailVerificationOtpSentAt",
        "+emailVerificationOtpAttemptCount",
      ].join(" ")
    );

    /*
     * We use a general response here so that the endpoint does
     * not clearly reveal whether an email address is registered.
     */
    if (!user) {
      throw new AppError(
        "Invalid or expired verification code",
        400
      );
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: "Email address is already verified.",
        data: {
          user: user.toSafeObject(),
        },
      });
    }

    if (
      !user.emailVerificationOtpHash ||
      !user.emailVerificationOtpExpiresAt
    ) {
      throw new AppError(
        "No active verification code was found. Please request a new code.",
        400
      );
    }

    const currentTime = new Date();

    if (
      user.emailVerificationOtpExpiresAt.getTime() <=
      currentTime.getTime()
    ) {
      clearEmailVerificationOtp(user);

      await user.save({
        validateBeforeSave: false,
      });

      throw new AppError(
        "Verification code has expired. Please request a new code.",
        400
      );
    }

    const currentAttemptCount =
      user.emailVerificationOtpAttemptCount || 0;

    if (currentAttemptCount >= maximumAttempts) {
      clearEmailVerificationOtp(user, {
        clearSentAt: false,
      });

      await user.save({
        validateBeforeSave: false,
      });

      throw new AppError(
        "Maximum verification attempts exceeded. Please request a new code.",
        429
      );
    }

    const isOtpCorrect = securelyCompareToken(
      otp,
      user.emailVerificationOtpHash
    );

    if (!isOtpCorrect) {
      user.emailVerificationOtpAttemptCount =
        currentAttemptCount + 1;

      const remainingAttempts =
        maximumAttempts -
        user.emailVerificationOtpAttemptCount;

      if (remainingAttempts <= 0) {
        clearEmailVerificationOtp(user, {
          clearSentAt: false,
        });

        await user.save({
          validateBeforeSave: false,
        });

        throw new AppError(
          "Maximum verification attempts exceeded. Please request a new code.",
          429
        );
      }

      await user.save({
        validateBeforeSave: false,
      });

      throw new AppError(
        `Invalid verification code. ${remainingAttempts} attempt${
          remainingAttempts === 1 ? "" : "s"
        } remaining.`,
        400
      );
    }

    user.isEmailVerified = true;

    clearEmailVerificationOtp(user);

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,
      message: "Email address verified successfully.",
      data: {
        user: user.toSafeObject(),
      },
    });
  }
);

export const resendVerificationOtp = asyncHandler(
  async (req, res) => {
    const { email } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    const otpExpiresInMinutes =
      getIntegerEnvironmentValue({
        variableName: "OTP_EXPIRES_MINUTES",
        defaultValue: 10,
        minimum: 1,
        maximum: 60,
      });

    const resendCooldownSeconds =
      getIntegerEnvironmentValue({
        variableName:
          "OTP_RESEND_COOLDOWN_SECONDS",
        defaultValue: 60,
        minimum: 30,
        maximum: 3600,
      });

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      [
        "+emailVerificationOtpHash",
        "+emailVerificationOtpExpiresAt",
        "+emailVerificationOtpSentAt",
        "+emailVerificationOtpAttemptCount",
      ].join(" ")
    );

    /*
     * This generic response reduces account enumeration.
     * No email is sent when the account does not exist or is
     * already verified.
     */
    if (!user || user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message:
          "If an unverified account exists for this email address, a new verification code will be sent.",
      });
    }

    const currentTime = new Date();

    if (user.emailVerificationOtpSentAt) {
      const elapsedMilliseconds =
        currentTime.getTime() -
        user.emailVerificationOtpSentAt.getTime();

      const cooldownMilliseconds =
        resendCooldownSeconds * 1000;

      if (
        elapsedMilliseconds < cooldownMilliseconds
      ) {
        const remainingSeconds = Math.ceil(
          (cooldownMilliseconds -
            elapsedMilliseconds) /
            1000
        );

        throw new AppError(
          `Please wait ${remainingSeconds} second${
            remainingSeconds === 1 ? "" : "s"
          } before requesting another code.`,
          429
        );
      }
    }

    const otp = generateSixDigitOtp();

    const otpExpiresAt = new Date(
      currentTime.getTime() +
        otpExpiresInMinutes * 60 * 1000
    );

    user.emailVerificationOtpHash = hashToken(otp);
    user.emailVerificationOtpExpiresAt =
      otpExpiresAt;
    user.emailVerificationOtpSentAt = currentTime;
    user.emailVerificationOtpAttemptCount = 0;

    await user.save({
      validateBeforeSave: false,
    });

    try {
      await sendEmailVerificationOtp({
        recipientEmail: user.email,
        recipientName: user.fullName,
        otp,
        expiresInMinutes: otpExpiresInMinutes,
      });
    } catch (error) {
      console.error(
        "Verification email resend failed:",
        error.message
      );

      clearEmailVerificationOtp(user);

      await user.save({
        validateBeforeSave: false,
      });

      throw new AppError(
        "The verification email could not be sent. Please try again later.",
        503
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "A new verification code has been sent to your email.",
      data: {
        email: user.email,
        otpExpiresInMinutes,
        resendCooldownSeconds,
      },
    });
  }
);