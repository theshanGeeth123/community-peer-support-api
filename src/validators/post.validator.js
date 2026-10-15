import { body, param, query } from "express-validator";

import {
  CONTENT_WARNING,
  POST_SORT,
  TRANSLATION_LANGUAGE,
} from "../constants/post.constants.js";

export const groupIdParamValidator = [
  param("groupId").isMongoId().withMessage("Invalid group ID"),
];

export const postIdParamValidator = [
  param("postId").isMongoId().withMessage("Invalid post ID"),
];

export const translatePostValidator = [
  param("postId").isMongoId().withMessage("Invalid post ID"),

  body("language")
    .isIn(Object.values(TRANSLATION_LANGUAGE))
    .withMessage(
      `Language must be one of: ${Object.values(TRANSLATION_LANGUAGE).join(", ")}`
    ),
];

export const commentIdParamValidator = [
  param("commentId").isMongoId().withMessage("Invalid comment ID"),
];

export const listMyFeedValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .bail()
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .bail()
    .toInt(),
];

export const listCrisisAlertsValidator = [
  query("status")
    .optional()
    .isIn(["open", "handled", "all"])
    .withMessage("Status must be open, handled or all"),

  query("groupId")
    .optional()
    .isMongoId()
    .withMessage("Invalid group ID"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .bail()
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .bail()
    .toInt(),
];

export const listNeedsResponseValidator = [
  query("groupId")
    .optional()
    .isMongoId()
    .withMessage("Invalid group ID"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .bail()
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .bail()
    .toInt(),
];

export const listPostsValidator = [
  param("groupId").isMongoId().withMessage("Invalid group ID"),

  query("q")
    .optional()
    .isString()
    .withMessage("Search text must be text")
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search text cannot exceed 100 characters"),

  query("sort")
    .optional()
    .isIn(Object.values(POST_SORT))
    .withMessage(
      `Sort must be one of: ${Object.values(POST_SORT).join(", ")}`
    ),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .bail()
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .bail()
    .toInt(),
];

export const createPostValidator = [
  param("groupId").isMongoId().withMessage("Invalid group ID"),

  body("content")
    .notEmpty()
    .withMessage("Post content is required")
    .bail()
    .isString()
    .withMessage("Post content must be text")
    .bail()
    .trim()
    .isLength({ min: 1, max: 3000 })
    .withMessage("Post content must contain between 1 and 3000 characters"),

  body("isAnonymous")
    .optional()
    .isBoolean()
    .withMessage("isAnonymous must be true or false")
    .bail()
    .toBoolean(),

  body("contentWarnings")
    .optional()
    .isArray({ max: Object.keys(CONTENT_WARNING).length })
    .withMessage("contentWarnings must be a list"),

  body("contentWarnings.*")
    .isIn(Object.values(CONTENT_WARNING))
    .withMessage("Invalid content warning"),
];

export const createCommentValidator = [
  param("postId").isMongoId().withMessage("Invalid post ID"),

  body("content")
    .notEmpty()
    .withMessage("Comment content is required")
    .bail()
    .isString()
    .withMessage("Comment content must be text")
    .bail()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Comment content must contain between 1 and 1000 characters"),
];
