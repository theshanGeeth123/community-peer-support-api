import express from "express";

import {
  getPostComments,
} from "../controllers/post.controller.js";

import {
  createComment,
  updateComment,
  deleteComment,
  createReply,
  toggleCommentHeart,
  toggleCommentReaction,
  toggleCommentPin,
} from "../controllers/postEngagement.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

import {
  uploadCommentMediaFiles,
} from "../middleware/commentMediaUpload.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  commentIdParamValidator,
  createCommentValidator,
  postIdParamValidator,
} from "../validators/post.validator.js";

const router = express.Router();

router.use(authenticate);

/*
|--------------------------------------------------------------------------
| COMMENTS
|--------------------------------------------------------------------------
*/

/*
 * Get all comments for a post
 */
router.get(
  "/posts/:postId/comments",
  postIdParamValidator,
  validateRequest,
  getPostComments
);

/*
 * Create a new comment
 *
 * Supports:
 * - Text only
 * - Text + photos
 * - Text + videos
 * - Text + photos + videos
 */
router.post(
  "/posts/:postId/comments",

  uploadCommentMediaFiles,

  /*
   * TEMPORARY DEBUG
   *
   * This does not change the comment logic.
   * It only checks whether Multer received
   * the uploaded media.
   */
  (req, res, next) => {
    console.log(
      "\n========== COMMENT MEDIA DEBUG =========="
    );

    console.log(
      "Content-Type:",
      req.headers["content-type"]
    );

    console.log(
      "Request body:",
      req.body
    );

    console.log(
      "Request files:",
      req.files
    );

    console.log(
      "Number of uploaded files:",
      Array.isArray(req.files)
        ? req.files.length
        : 0
    );

    if (
      Array.isArray(req.files) &&
      req.files.length > 0
    ) {
      req.files.forEach(
        (file, index) => {
          console.log(
            `File ${index + 1}:`
          );

          console.log(
            "  fieldname:",
            file.fieldname
          );

          console.log(
            "  originalname:",
            file.originalname
          );

          console.log(
            "  mimetype:",
            file.mimetype
          );

          console.log(
            "  size:",
            file.size
          );

          console.log(
            "  buffer exists:",
            Boolean(file.buffer)
          );
        }
      );
    }

    console.log(
      "==========================================\n"
    );

    next();
  },

  createCommentValidator,
  validateRequest,
  createComment
);

/*
 * Update an existing comment
 */
router.patch(
  "/comments/:commentId",
  commentIdParamValidator,
  validateRequest,
  updateComment
);

/*
 * Delete a comment
 */
router.delete(
  "/comments/:commentId",
  commentIdParamValidator,
  validateRequest,
  deleteComment
);

/*
 * Reply to a comment
 *
 * Supports:
 * - Text only
 * - Text + photos
 * - Text + videos
 * - Text + photos + videos
 */
router.post(
  "/comments/:commentId/replies",

  uploadCommentMediaFiles,

  /*
   * TEMPORARY DEBUG
   *
   * This does not change the reply logic.
   * It only checks whether Multer received
   * the uploaded media.
   */
  (req, res, next) => {
    console.log(
      "\n========== REPLY MEDIA DEBUG =========="
    );

    console.log(
      "Content-Type:",
      req.headers["content-type"]
    );

    console.log(
      "Request body:",
      req.body
    );

    console.log(
      "Request files:",
      req.files
    );

    console.log(
      "Number of uploaded files:",
      Array.isArray(req.files)
        ? req.files.length
        : 0
    );

    if (
      Array.isArray(req.files) &&
      req.files.length > 0
    ) {
      req.files.forEach(
        (file, index) => {
          console.log(
            `File ${index + 1}:`
          );

          console.log(
            "  fieldname:",
            file.fieldname
          );

          console.log(
            "  originalname:",
            file.originalname
          );

          console.log(
            "  mimetype:",
            file.mimetype
          );

          console.log(
            "  size:",
            file.size
          );

          console.log(
            "  buffer exists:",
            Boolean(file.buffer)
          );
        }
      );
    }

    console.log(
      "========================================\n"
    );

    next();
  },

  commentIdParamValidator,
  validateRequest,
  createReply
);

/*
 * Heart / unheart a comment
 */
router.post(
  "/comments/:commentId/heart",
  commentIdParamValidator,
  validateRequest,
  toggleCommentHeart
);

/*
 * React / change / remove reaction on a comment or reply
 *
 * Supported reactions:
 * like
 * love
 * haha
 * wow
 * sad
 * angry
 */
router.post(
  "/comments/:commentId/reaction",
  commentIdParamValidator,
  validateRequest,
  toggleCommentReaction
);

/*
 * Pin / unpin own comment
 *
 * A user can only pin or unpin
 * their own comment.
 */
router.patch(
  "/comments/:commentId/pin",
  commentIdParamValidator,
  validateRequest,
  toggleCommentPin
);

export default router;