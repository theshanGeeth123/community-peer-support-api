import express from "express";

import {
  createPost,
  deletePost,
  getGroupPosts,
  getMyFeed,
  getPostById,
  getPostComments,
  togglePostLike,
  togglePostPin,
} from "../controllers/post.controller.js";

import {
  createComment,
  updateComment,
  deleteComment,
  createReply,
  toggleCommentHeart,
} from "../controllers/postEngagement.controller.js";

import { USER_ROLES } from "../constants/auth.constants.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

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
 */
router.post(
  "/posts/:postId/comments",
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
 */
router.post(
  "/comments/:commentId/replies",
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

export default router;