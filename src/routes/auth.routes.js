import express from "express";

import {
  registerUser,
  resendVerificationOtp,
  verifyEmailOtp,
} from "../controllers/auth.controller.js";

import {
  getCurrentUser,
  loginUser,
  logoutUser,
} from "../controllers/authSession.controller.js";

import {
  authenticate,
} from "../middleware/auth.middleware.js";

import {
  authenticationSessionLimiter,
  emailVerificationLimiter,
  forgotPasswordLimiter,
  googleLoginLimiter,
  loginLimiter,
  registrationLimiter,
  resendVerificationLimiter,
  resetPasswordLimiter,
} from "../middleware/rateLimit.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  forgotPasswordValidator,
  googleLoginValidator,
  loginValidator,
  registerValidator,
  resendVerificationOtpValidator,
  resetPasswordValidator,
  verifyEmailOtpValidator,
} from "../validators/auth.validator.js";

import {
  forgotPassword,
  resetPassword,
} from "../controllers/passwordReset.controller.js";

import {
  loginWithGoogle,
} from "../controllers/googleAuth.controller.js";

const router = express.Router();

router.post(
  "/register",
  registrationLimiter,
  registerValidator,
  validateRequest,
  registerUser
);

router.post(
  "/verify-email",
  emailVerificationLimiter,
  verifyEmailOtpValidator,
  validateRequest,
  verifyEmailOtp
);

router.post(
  "/resend-verification-otp",
  resendVerificationLimiter,
  resendVerificationOtpValidator,
  validateRequest,
  resendVerificationOtp
);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  forgotPasswordValidator,
  validateRequest,
  forgotPassword
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  resetPasswordValidator,
  validateRequest,
  resetPassword
);

router.post(
  "/google",
  googleLoginLimiter,
  googleLoginValidator,
  validateRequest,
  loginWithGoogle
);

router.post(
  "/login",
  loginLimiter,
  loginValidator,
  validateRequest,
  loginUser
);

router.get(
  "/me",
  authenticate,
  getCurrentUser
);

router.post(
  "/logout",
  authenticationSessionLimiter,
  authenticate,
  logoutUser
);

export default router;