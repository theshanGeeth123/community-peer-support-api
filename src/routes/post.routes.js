import express from "express";

import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getGroupPosts,
  getMyFeed,
  getPostById,
  getPostComments,
  togglePostLike,
  togglePostPin,
} from "../controllers/post.controller.js";

import { USER_ROLES } from "../constants/auth.constants.js";

import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  commentIdParamValidator,
  createCommentValidator,
  createPostValidator,
  listMyFeedValidator,
  listPostsValidator,
  postIdParamValidator,
} from "../validators/post.validator.js";

const router = express.Router();

router.use(authenticate);

/*
|--------------------------------------------------------------------------
| MY FEED
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This route MUST stay before "/posts/:postId".
| Otherwise Express may treat "my-feed" as a postId.
|
*/

router.get(
  "/posts/my-feed",
  authorizeRoles(USER_ROLES.USER),
  listMyFeedValidator,
  validateRequest,
  getMyFeed
);

/*
|--------------------------------------------------------------------------
| GROUP POSTS
|--------------------------------------------------------------------------
*/

router.post(
  "/groups/:groupId/posts",
  createPostValidator,
  validateRequest,
  createPost
);

router.get(
  "/groups/:groupId/posts",
  listPostsValidator,
  validateRequest,
  getGroupPosts
);

/*
|--------------------------------------------------------------------------
| SINGLE POST
|--------------------------------------------------------------------------
*/

router.get(
  "/posts/:postId",
  postIdParamValidator,
  validateRequest,
  getPostById
);

router.delete(
  "/posts/:postId",
  postIdParamValidator,
  validateRequest,
  deletePost
);

router.post(
  "/posts/:postId/like",
  postIdParamValidator,
  validateRequest,
  togglePostLike
);

router.post(
  "/posts/:postId/pin",
  postIdParamValidator,
  validateRequest,
  togglePostPin
);

/*
|--------------------------------------------------------------------------
| COMMENTS
|--------------------------------------------------------------------------
*/

router.get(
  "/posts/:postId/comments",
  postIdParamValidator,
  validateRequest,
  getPostComments
);

router.post(
  "/posts/:postId/comments",
  createCommentValidator,
  validateRequest,
  createComment
);

router.delete(
  "/comments/:commentId",
  commentIdParamValidator,
  validateRequest,
  deleteComment
);

export default router;
