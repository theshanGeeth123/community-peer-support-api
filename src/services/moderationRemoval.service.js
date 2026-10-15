import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";

import {
  MODERATION_ACTION_TYPE,
  REPORT_TARGET_TYPE,
} from "../constants/moderation.constants.js";

import AppError from "../utils/AppError.js";

import { deleteNotificationsForPost } from "./notification.service.js";
import { deletePostImageFromCloudinary } from "./postImage.service.js";

/*
|--------------------------------------------------------------------------
| MODERATION REMOVAL
|--------------------------------------------------------------------------
|
| Carries out a moderator's REMOVE decision. Content is hidden (soft
| removed), not deleted, so Moderation History keeps a record of what
| was removed. Images are deleted from Cloudinary because they are no
| longer shown anywhere.
|
*/

/**
 * Filter that leaves out removed posts/comments. Uses $ne so documents
 * created before this field existed still match.
 */
export const NOT_REMOVED = Object.freeze({ isRemoved: { $ne: true } });

const assertSameGroup = (content, report) => {
  if (content.group.toString() !== report.group.toString()) {
    throw new AppError(
      "The reported content does not belong to this report's group",
      400
    );
  }
};

const removePost = async ({ report, moderatorId, reason }) => {
  const post = await Post.findById(report.targetId);

  /*
   * Already deleted by its author, or already removed: nothing to do.
   */
  if (!post || post.isRemoved) {
    return;
  }

  assertSameGroup(post, report);

  const imagePublicId = post.imagePublicId;

  post.isRemoved = true;
  post.removedAt = new Date();
  post.removedBy = moderatorId;
  post.removalReason = reason ?? null;

  /*
   * The image is deleted below, so the post must stop pointing at it.
   */
  post.imageUrl = null;
  post.imagePublicId = null;

  await post.save();

  await Promise.all([
    deletePostImageFromCloudinary(imagePublicId),
    deleteNotificationsForPost(post._id),
  ]);
};

const removeComment = async ({ report, moderatorId }) => {
  const comment = await PostComment.findById(report.targetId);

  if (!comment || comment.isRemoved) {
    return;
  }

  assertSameGroup(comment, report);

  /*
   * Removing a top-level comment also hides its replies, so they are
   * not left dangling under a comment that no longer shows.
   */
  const replies = comment.parentComment
    ? []
    : await PostComment.find({
        parentComment: comment._id,
        ...NOT_REMOVED,
      }).select("_id");

  const commentIds = [comment._id, ...replies.map((reply) => reply._id)];

  await PostComment.updateMany(
    { _id: { $in: commentIds } },
    {
      isRemoved: true,
      removedAt: new Date(),
      removedBy: moderatorId,
    }
  );

  /*
   * Keep commentCount in step with what members can see
   * (never below zero).
   */
  await Post.updateOne(
    { _id: comment.post },
    [
      {
        $set: {
          commentCount: {
            $max: [0, { $subtract: ["$commentCount", commentIds.length] }],
          },
        },
      },
    ],
    { updatePipeline: true }
  );
};

/**
 * Applies a reviewed report's action to its target.
 * Only REMOVE changes content; other actions do nothing here.
 */
export const applyModerationAction = async ({
  report,
  action,
  moderatorId,
  reason,
}) => {
  if (action !== MODERATION_ACTION_TYPE.REMOVE) {
    return;
  }

  if (report.targetType === REPORT_TARGET_TYPE.POST) {
    await removePost({ report, moderatorId, reason });
    return;
  }

  if (report.targetType === REPORT_TARGET_TYPE.COMMENT) {
    await removeComment({ report, moderatorId });
  }
};
