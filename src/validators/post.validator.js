import { body, param, query } from "express-validator";

export const groupIdParamValidator = [
  param("groupId").isMongoId().withMessage("Invalid group ID"),
];

export const postIdParamValidator = [
  param("postId").isMongoId().withMessage("Invalid post ID"),
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

export const listPostsValidator = [
  param("groupId").isMongoId().withMessage("Invalid group ID"),

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
