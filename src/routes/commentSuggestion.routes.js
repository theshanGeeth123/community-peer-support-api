import express from "express";
import { body } from "express-validator";

import {
  createCommentSuggestions,
} from "../controllers/commentSuggestion.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import validateRequest from "../middleware/validate.middleware.js";
import { commentSuggestionLimiter } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post(
  "/comments/ai-suggestions",
  commentSuggestionLimiter,
  body("postContent")
    .isString()
    .withMessage("Post content must be text")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Post content is required")
    .bail()
    .isLength({ max: 3000 })
    .withMessage("Post content cannot exceed 3000 characters"),
  body("tone")
    .equals("supportive")
    .withMessage("Tone must be supportive"),
  validateRequest,
  createCommentSuggestions
);

export default router;
