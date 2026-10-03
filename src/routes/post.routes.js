import express from "express";

import {
  createPost,
  deletePost,
  getCrisisAlerts,
  getGroupPosts,
  getMyFeed,
  getNeedsResponseQueue,
  getPostById,
  getPostComments,
  markCrisisAlertHandled,
  togglePostLike,
  togglePostPin,
  togglePostReaction,
  translatePost,
} from "../controllers/post.controller.js";

import { USER_ROLES } from "../constants/auth.constants.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";
import { uploadPostImageFile } from "../middleware/postImageUpload.middleware.js";

import {
  createPostValidator,
  listCrisisAlertsValidator,
  listMyFeedValidator,
  listNeedsResponseValidator,
  listPostsValidator,
  postIdParamValidator,
  translatePostValidator,
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
| STAFF QUEUES (crisis alerts, needs a response)
|--------------------------------------------------------------------------
|
| Same rule as my-feed: keep before "/posts/:postId".
|
*/

const STAFF_ROLES = [
  USER_ROLES.MODERATOR,
  USER_ROLES.PEER_SUPPORTER,
  USER_ROLES.ADMIN,
];

router.get(
  "/posts/crisis-alerts",
  authorizeRoles(...STAFF_ROLES),
  listCrisisAlertsValidator,
  validateRequest,
  getCrisisAlerts
);

router.get(
  "/posts/needs-response",
  authorizeRoles(...STAFF_ROLES),
  listNeedsResponseValidator,
  validateRequest,
  getNeedsResponseQueue
);

/*
|--------------------------------------------------------------------------
| GROUP POSTS
|--------------------------------------------------------------------------
*/

/*
 * Accepts JSON, or multipart/form-data with an optional "image" file.
 */

router.post(
  "/groups/:groupId/posts",
  uploadPostImageFile,
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

/*
|--------------------------------------------------------------------------
| OLD POST LIKE
|--------------------------------------------------------------------------
|
| Existing like functionality is kept unchanged.
|
*/

router.post(
  "/posts/:postId/like",
  postIdParamValidator,
  validateRequest,
  togglePostLike
);

/*
|--------------------------------------------------------------------------
| POST REACTIONS
|--------------------------------------------------------------------------
|
| Multiple reactions:
|
| like  → 👍
| love  → ❤️
| haha  → 😂
| wow   → 😮
| sad   → 😢
| angry → 😡
|
*/

router.post(
  "/posts/:postId/reaction",
  postIdParamValidator,
  validateRequest,
  togglePostReaction
);

/*
|--------------------------------------------------------------------------
| POST PIN / UNPIN
|--------------------------------------------------------------------------
*/

router.post(
  "/posts/:postId/pin",
  postIdParamValidator,
  validateRequest,
  togglePostPin
);

/*
 * Translate a post into English, Sinhala or Tamil (body: { language }).
 */
router.post(
  "/posts/:postId/translate",
  translatePostValidator,
  validateRequest,
  translatePost
);

/*
|--------------------------------------------------------------------------
| POST COMMENTS
|--------------------------------------------------------------------------
*/

router.get(
  "/posts/:postId/comments",
  postIdParamValidator,
  validateRequest,
  getPostComments
);

/*
|--------------------------------------------------------------------------
| CRISIS ALERT
|--------------------------------------------------------------------------
*/

router.patch(
  "/posts/:postId/crisis-flag/handle",
  postIdParamValidator,
  validateRequest,
  markCrisisAlertHandled
);

export default router;