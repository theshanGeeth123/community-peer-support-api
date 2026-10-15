import Notification from "../models/Notification.js";

import { NOTIFICATION_TYPE } from "../constants/notification.constants.js";

/*
|--------------------------------------------------------------------------
| NOTIFICATION SERVICE
|--------------------------------------------------------------------------
|
| Called after a comment, reply or like has been saved. These functions
| never throw: a notification failing must never break the action that
| triggered it, so errors are only logged.
|
*/

const toId = (value) => (value?._id ?? value)?.toString() ?? null;

const logFailure = (action, error) => {
  console.error(`[notifications] Failed to ${action}:`, error?.message ?? error);
};

const createNotification = ({ recipient, type, actorId, post, comment }) =>
  Notification.create({
    recipient,
    type,
    actor: actorId,
    actors: [actorId],
    post: post._id,
    group: toId(post.group),
    comment: comment?._id ?? null,
  });

/**
 * Someone commented on a post → notify the post author.
 */
export const notifyPostComment = async ({ post, comment, actorId }) => {
  try {
    const postAuthorId = toId(post.author);

    if (!postAuthorId || postAuthorId === toId(actorId)) {
      return;
    }

    await createNotification({
      recipient: postAuthorId,
      type: NOTIFICATION_TYPE.POST_COMMENT,
      actorId,
      post,
      comment,
    });
  } catch (error) {
    logFailure("notify post comment", error);
  }
};

/**
 * Someone replied to a comment → notify the comment author, and the
 * post author too (as a new comment) if they are a different person.
 */
export const notifyCommentReply = async ({
  post,
  parentComment,
  reply,
  actorId,
}) => {
  try {
    const actor = toId(actorId);
    const commentAuthorId = toId(parentComment.author);
    const postAuthorId = toId(post.author);

    const jobs = [];

    if (commentAuthorId && commentAuthorId !== actor) {
      jobs.push(
        createNotification({
          recipient: commentAuthorId,
          type: NOTIFICATION_TYPE.COMMENT_REPLY,
          actorId,
          post,
          comment: reply,
        })
      );
    }

    if (
      postAuthorId &&
      postAuthorId !== actor &&
      postAuthorId !== commentAuthorId
    ) {
      jobs.push(
        createNotification({
          recipient: postAuthorId,
          type: NOTIFICATION_TYPE.POST_COMMENT,
          actorId,
          post,
          comment: reply,
        })
      );
    }

    await Promise.all(jobs);
  } catch (error) {
    logFailure("notify comment reply", error);
  }
};

/**
 * Someone liked a post → add them to the post author's unread
 * "supported your post" notification (or start a new one).
 */
export const notifyPostLike = async ({ post, actorId }) => {
  try {
    const postAuthorId = toId(post.author);

    if (!postAuthorId || postAuthorId === toId(actorId)) {
      return;
    }

    await Notification.findOneAndUpdate(
      {
        recipient: postAuthorId,
        post: post._id,
        type: NOTIFICATION_TYPE.POST_LIKE,
        isRead: false,
      },
      {
        $set: { actor: actorId, group: toId(post.group) },
        $addToSet: { actors: actorId },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    logFailure("notify post like", error);
  }
};

/**
 * Someone un-liked a post → take them out of the unread like
 * notification, and delete it if nobody is left.
 */
export const removePostLikeNotification = async ({ post, actorId }) => {
  try {
    const filter = {
      recipient: toId(post.author),
      post: post._id,
      type: NOTIFICATION_TYPE.POST_LIKE,
      isRead: false,
    };

    const updated = await Notification.findOneAndUpdate(
      filter,
      { $pull: { actors: actorId } },
      { new: true }
    );

    if (updated && updated.actors.length === 0) {
      await Notification.deleteOne({ _id: updated._id });
    } else if (updated && toId(updated.actor) === toId(actorId)) {
      /*
       * Show the most recent remaining person instead.
       */
      updated.actor = updated.actors[updated.actors.length - 1];
      await updated.save();
    }
  } catch (error) {
    logFailure("remove post like notification", error);
  }
};

/**
 * A post was deleted → its notifications point nowhere, remove them.
 */
export const deleteNotificationsForPost = async (postId) => {
  try {
    await Notification.deleteMany({ post: postId });
  } catch (error) {
    logFailure("delete post notifications", error);
  }
};
