import express from "express";

import {
  createGlobalPost,
  createGlobalPostComment,
  deleteGlobalPost,
  deleteGlobalPostComment,
  getGlobalFeed,
  getGlobalPostById,
  getGlobalPostComments,
  toggleGlobalPostLike,
} from "../controllers/globalPost.controller.js";

import { USER_ROLES } from "../constants/auth.constants.js";

import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  commentIdParamValidator,
  createGlobalPostCommentValidator,
  createGlobalPostValidator,
  listGlobalFeedValidator,
  postIdParamValidator,
} from "../validators/globalPost.validator.js";

const router = express.Router();

router.use(authenticate);

const WALL_AUTHOR_ROLES = [
  USER_ROLES.MODERATOR,
  USER_ROLES.PEER_SUPPORTER,
  USER_ROLES.ADMIN,
];

/*
|--------------------------------------------------------------------------
| FEED
|--------------------------------------------------------------------------
*/

router.get("/", listGlobalFeedValidator, validateRequest, getGlobalFeed);

router.post(
  "/",
  authorizeRoles(...WALL_AUTHOR_ROLES),
  createGlobalPostValidator,
  validateRequest,
  createGlobalPost
);

/*
|--------------------------------------------------------------------------
| SINGLE POST
|--------------------------------------------------------------------------
*/

router.get(
  "/:postId",
  postIdParamValidator,
  validateRequest,
  getGlobalPostById
);

router.delete(
  "/:postId",
  postIdParamValidator,
  validateRequest,
  deleteGlobalPost
);

router.post(
  "/:postId/like",
  postIdParamValidator,
  validateRequest,
  toggleGlobalPostLike
);

/*
|--------------------------------------------------------------------------
| COMMENTS
|--------------------------------------------------------------------------
*/

router.get(
  "/:postId/comments",
  postIdParamValidator,
  validateRequest,
  getGlobalPostComments
);

router.post(
  "/:postId/comments",
  createGlobalPostCommentValidator,
  validateRequest,
  createGlobalPostComment
);

router.delete(
  "/comments/:commentId",
  commentIdParamValidator,
  validateRequest,
  deleteGlobalPostComment
);

export default router;
