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
  loginLimiter,
  registrationLimiter,
  resendVerificationLimiter,
} from "../middleware/rateLimit.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  loginValidator,
  registerValidator,
  resendVerificationOtpValidator,
  verifyEmailOtpValidator,
} from "../validators/auth.validator.js";

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