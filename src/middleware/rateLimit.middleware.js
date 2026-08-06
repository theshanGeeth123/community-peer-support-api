import { rateLimit } from "express-rate-limit";

const isDevelopment =
  process.env.NODE_ENV === "development";

const createRateLimitResponse = (message) => ({
  success: false,
  message,
});

export const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDevelopment ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,

  message: createRateLimitResponse(
    "Too many registration attempts. Please try again after 15 minutes."
  ),
});

export const emailVerificationLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isDevelopment ? 100 : 10,
    standardHeaders: true,
    legacyHeaders: false,

    message: createRateLimitResponse(
      "Too many verification attempts. Please try again after 15 minutes."
    ),
  });

export const resendVerificationLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isDevelopment ? 50 : 5,
    standardHeaders: true,
    legacyHeaders: false,

    message: createRateLimitResponse(
      "Too many verification-code requests. Please try again after 15 minutes."
    ),
  });

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDevelopment ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,

  message: createRateLimitResponse(
    "Too many login attempts. Please try again after 15 minutes."
  ),
});

export const authenticationSessionLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isDevelopment ? 100 : 30,
    standardHeaders: true,
    legacyHeaders: false,

    message: createRateLimitResponse(
      "Too many authentication requests. Please try again later."
    ),
  });

  export const forgotPasswordLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: isDevelopment ? 100 : 5,

    standardHeaders: true,
    legacyHeaders: false,

    message: createRateLimitResponse(
      "Too many password reset requests. Please try again after 15 minutes."
    ),
  });

export const resetPasswordLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: isDevelopment ? 100 : 10,

    standardHeaders: true,
    legacyHeaders: false,

    message: createRateLimitResponse(
      "Too many password reset attempts. Please try again after 15 minutes."
    ),
  });