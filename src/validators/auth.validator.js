import { body } from "express-validator";

export const registerValidator = [
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .bail()
    .isLength({ min: 2, max: 80 })
    .withMessage(
      "Full name must contain between 2 and 80 characters"
    ),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email address is required")
    .bail()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .bail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage("Email address is too long"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .bail()
    .isString()
    .withMessage("Password must be text")
    .bail()
    .isLength({ min: 8, max: 64 })
    .withMessage(
      "Password must contain between 8 and 64 characters"
    )
    .bail()
    .matches(/[a-z]/)
    .withMessage(
      "Password must contain at least one lowercase letter"
    )
    .bail()
    .matches(/[A-Z]/)
    .withMessage(
      "Password must contain at least one uppercase letter"
    )
    .bail()
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .bail()
    .matches(/[^A-Za-z0-9]/)
    .withMessage(
      "Password must contain at least one special character"
    ),
];

export const verifyEmailOtpValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email address is required")
    .bail()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .bail()
    .normalizeEmail(),

  body("otp")
    .trim()
    .notEmpty()
    .withMessage("Verification code is required")
    .bail()
    .matches(/^\d{6}$/)
    .withMessage(
      "Verification code must contain exactly six digits"
    ),
];

export const resendVerificationOtpValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email address is required")
    .bail()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .bail()
    .normalizeEmail(),
];

export const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email address is required")
    .bail()
    .isEmail()
    .withMessage(
      "Please provide a valid email address"
    )
    .bail()
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .bail()
    .isString()
    .withMessage("Password must be text")
    .bail()
    .isLength({ min: 8, max: 64 })
    .withMessage(
      "Password must contain between 8 and 64 characters"
    ),
];



