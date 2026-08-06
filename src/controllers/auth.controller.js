import User from "../models/User.js";

import { AUTH_PROVIDERS } from "../constants/auth.constants.js";
import { sendEmailVerificationOtp } from "../services/email.service.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  generateSixDigitOtp,
  hashToken,
} from "../utils/token.util.js";

export const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  const normalizedEmail = email.trim().toLowerCase();

  const otpExpiresInMinutes = Number(
    process.env.OTP_EXPIRES_MINUTES || 10
  );

  if (
    !Number.isInteger(otpExpiresInMinutes) ||
    otpExpiresInMinutes < 1 ||
    otpExpiresInMinutes > 60
  ) {
    throw new AppError(
      "OTP expiration configuration is invalid",
      500
    );
  }

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
  const otpHash = hashToken(otp);
  const currentTime = new Date();

  const otpExpiresAt = new Date(
    currentTime.getTime() + otpExpiresInMinutes * 60 * 1000
  );

  const isNewUser = !user;

  if (isNewUser) {
    user = new User({
      fullName,
      email: normalizedEmail,
      password,
      authProviders: [AUTH_PROVIDERS.LOCAL],
      isEmailVerified: false,
      emailVerificationOtpHash: otpHash,
      emailVerificationOtpExpiresAt: otpExpiresAt,
      emailVerificationOtpSentAt: currentTime,
    });
  } else {
    user.fullName = fullName;
    user.password = password;
    user.isEmailVerified = false;
    user.emailVerificationOtpHash = otpHash;
    user.emailVerificationOtpExpiresAt = otpExpiresAt;
    user.emailVerificationOtpSentAt = currentTime;

    if (!user.authProviders.includes(AUTH_PROVIDERS.LOCAL)) {
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
    console.error("Verification email delivery failed:", error.message);

    throw new AppError(
      "Your account was created, but the verification email could not be sent. Please try registering again.",
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