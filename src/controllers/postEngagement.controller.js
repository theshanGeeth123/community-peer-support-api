import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import CommentLike from "../models/CommentLike.js";
import CommentReaction from "../models/CommentReaction.js";
import SupportGroup from "../models/SupportGroup.js";
import GroupMembership from "../models/GroupMembership.js";

import { USER_ROLES } from "../constants/auth.constants.js";
import {
  GROUP_STATUS,
  GROUP_MEMBERSHIP_STATUS,
} from "../constants/group.constants.js";

import {
  uploadCommentMediaToCloudinary,
  deleteCommentMediaFromCloudinary,
} from "../services/commentMedia.service.js";

import {
  notifyCommentReply,
  notifyPostComment,
} from "../services/notification.service.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const AUTHOR_SELECT_FIELDS =
  "fullName email role avatarUrl accountStatus";

const COMMENT_REACTION_TYPES = Object.freeze([
  "like",
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
]);

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const populateCommentAuthor = (query) => {
  return query.populate({
    path: "author",
    select: AUTHOR_SELECT_FIELDS,
  });
};

const getActivePostAndGroupOrThrow = async (postId) => {
  const post = await Post.findById(postId);

  // Posts removed by moderation can no longer be commented on.
  if (!post || post.isRemoved) {
    throw new AppError("Post was not found", 404);
  }

  const group = await SupportGroup.findOne({
    _id: post.group,
    status: GROUP_STATUS.ACTIVE,
  });

  if (!group) {
    throw new AppError(
      "Active support group was not found",
      404
    );
  }

  return { post, group };
};

const getCommentWithGroupOrThrow = async (commentId) => {
  const comment = await PostComment.findById(commentId);

  // Comments removed by moderation behave as if they no longer exist.
  if (!comment || comment.isRemoved) {
    throw new AppError(
      "Comment was not found",
      404
    );
  }

  const group = await SupportGroup.findOne({
    _id: comment.group,
    status: GROUP_STATUS.ACTIVE,
  });

  if (!group) {
    throw new AppError(
      "Active support group was not found",
      404
    );
  }

  return { comment, group };
};

const isGroupStaffOrAdmin = (user, group) => {
  if (user.role === USER_ROLES.ADMIN) {
    return true;
  }

  if (user.role === USER_ROLES.MODERATOR) {
    return group.moderators.some(
      (id) =>
        id.toString() === user._id.toString()
    );
  }

  if (user.role === USER_ROLES.PEER_SUPPORTER) {
    return group.peerSupporters.some(
      (id) =>
        id.toString() === user._id.toString()
    );
  }

  return false;
};

const assertCanEngageOrThrow = async (
  group,
  user
) => {
  if (isGroupStaffOrAdmin(user, group)) {
    return;
  }

  const membership =
    await GroupMembership.findOne({
      group: group._id,
      user: user._id,
      status:
        GROUP_MEMBERSHIP_STATUS.ACTIVE,
    });

  if (!membership) {
    throw new AppError(
      "You must be an active member of this group",
      403
    );
  }
};

const assertCanModifyCommentOrThrow = (
  comment,
  group,
  user
) => {
  const isAuthor =
    comment.author.toString() ===
    user._id.toString();

  if (
    isAuthor ||
    isGroupStaffOrAdmin(user, group)
  ) {
    return;
  }

  throw new AppError(
    "You do not have permission to modify this comment",
    403
  );
};

/*
|--------------------------------------------------------------------------
| GET COMMENT REACTION DATA
|--------------------------------------------------------------------------
*/

const getCommentReactionData = async (
  commentId,
  userId
) => {
  const reactions =
    await CommentReaction.find({
      comment: commentId,
    }).select(
      "user reactionType"
    );

  const reactionCounts = {
    like: 0,
    love: 0,
    haha: 0,
    wow: 0,
    sad: 0,
    angry: 0,
  };

  let myReaction = null;

  for (const reaction of reactions) {
    if (
      reactionCounts[reaction.reactionType] !==
      undefined
    ) {
      reactionCounts[reaction.reactionType] += 1;
    }

    if (
      reaction.user.toString() ===
      userId.toString()
    ) {
      myReaction = reaction.reactionType;
    }
  }

  return {
    myReaction,
    reactionCounts,
  };
};

/*
|--------------------------------------------------------------------------
| GET COMMENT MEDIA FILES
|--------------------------------------------------------------------------
|
| Multer will provide uploaded files through req.files.
|
| Each file is expected to contain:
|   - buffer
|   - mimetype
|
| Supported:
|   image/*
|   video/*
|
|--------------------------------------------------------------------------
*/

const getCommentMediaFiles = (req) => {
  if (!req.files) {
    return [];
  }

  /*
  |--------------------------------------------------
  | Supports:
  |
  | req.files = []
  |
  | and also:
  |
  | req.files = {
  |   media: []
  | }
  |--------------------------------------------------
  */

  if (Array.isArray(req.files)) {
    return req.files;
  }

  if (Array.isArray(req.files.media)) {
    return req.files.media;
  }

  return [];
};

/*
|--------------------------------------------------------------------------
| UPLOAD COMMENT MEDIA
|--------------------------------------------------------------------------
*/

const uploadCommentMedia = async (files) => {
  if (!files.length) {
    return [];
  }

  const uploadedMedia = [];

  try {
    for (const file of files) {
      let mediaType;

      if (
        file.mimetype &&
        file.mimetype.startsWith("image/")
      ) {
        mediaType = "image";
      } else if (
        file.mimetype &&
        file.mimetype.startsWith("video/")
      ) {
        mediaType = "video";
      } else {
        throw new AppError(
          "Only image and video files are allowed",
          400
        );
      }

      const uploaded =
        await uploadCommentMediaToCloudinary(
          file.buffer,
          mediaType
        );

      uploadedMedia.push({
        type: mediaType,
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
      });
    }

    return uploadedMedia;
  } catch (error) {
    /*
    |--------------------------------------------------
    | If one upload fails after previous files were
    | uploaded, clean those files from Cloudinary.
    |--------------------------------------------------
    */

    await Promise.all(
      uploadedMedia.map((media) =>
        deleteCommentMediaFromCloudinary(
          media.publicId,
          media.type
        )
      )
    );

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| DELETE COMMENT MEDIA
|--------------------------------------------------------------------------
*/

const deleteCommentMedia = async (
  comments
) => {
  const mediaToDelete = [];

  for (const comment of comments) {
    if (
      Array.isArray(comment.media) &&
      comment.media.length
    ) {
      mediaToDelete.push(
        ...comment.media
      );
    }
  }

  if (!mediaToDelete.length) {
    return;
  }

  await Promise.all(
    mediaToDelete.map((media) =>
      deleteCommentMediaFromCloudinary(
        media.publicId,
        media.type
      )
    )
  );
};

/*
|--------------------------------------------------------------------------
| CREATE COMMENT
|--------------------------------------------------------------------------
*/

export const createComment =
  asyncHandler(async (req, res) => {
    const { post, group } =
      await getActivePostAndGroupOrThrow(
        req.params.postId
      );

    await assertCanEngageOrThrow(
      group,
      req.user
    );

    const content =
      req.body.content?.trim();

    if (!content) {
      throw new AppError(
        "Comment content is required",
        400
      );
    }

    /*
    |--------------------------------------------------
    | Upload comment photos/videos
    |--------------------------------------------------
    */

    const mediaFiles =
      getCommentMediaFiles(req);

    const media =
      await uploadCommentMedia(
        mediaFiles
      );

    try {
      const comment =
        await PostComment.create({
          post: post._id,
          group: group._id,
          author: req.user._id,
          content,
          parentComment: null,
          media,
        });

      await Post.findByIdAndUpdate(
        post._id,
        {
          $inc: {
            commentCount: 1,
          },
        }
      );

      /*
      |--------------------------------------------------
      | Notify users about the new comment
      |--------------------------------------------------
      */

      void notifyPostComment({
        post,
        comment,
        actorId: req.user._id,
      });

      const populatedComment =
        await populateCommentAuthor(
          PostComment.findById(
            comment._id
          )
        );

      return res.status(201).json({
        success: true,
        message: "Comment added successfully",
        data: {
          comment: {
            ...populatedComment.toSafeObject(),
            author: {
              id: populatedComment.author._id.toString(),
              fullName:
                populatedComment.author.fullName,
              role:
                populatedComment.author.role,
              avatarUrl:
                populatedComment.author.avatarUrl,
              isAnonymized: false,
            },
          },
        },
      });
    } catch (error) {
      /*
      |--------------------------------------------------
      | If MongoDB save fails after Cloudinary upload,
      | remove uploaded media.
      |--------------------------------------------------
      */

      await Promise.all(
        media.map((item) =>
          deleteCommentMediaFromCloudinary(
            item.publicId,
            item.type
          )
        )
      );

      throw error;
    }
  });

/*
|--------------------------------------------------------------------------
| UPDATE COMMENT
|--------------------------------------------------------------------------
*/

export const updateComment =
  asyncHandler(async (req, res) => {
    const { comment, group } =
      await getCommentWithGroupOrThrow(
        req.params.commentId
      );

    await assertCanEngageOrThrow(
      group,
      req.user
    );

    assertCanModifyCommentOrThrow(
      comment,
      group,
      req.user
    );

    const content =
      req.body.content?.trim();

    if (!content) {
      throw new AppError(
        "Comment content is required",
        400
      );
    }

    comment.content = content;

    await comment.save();

    const updatedComment =
      await populateCommentAuthor(
        PostComment.findById(
          comment._id
        )
      );

    return res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: {
        comment: {
          ...updatedComment.toSafeObject(),
          author: {
            id: updatedComment.author._id.toString(),
            fullName:
              updatedComment.author.fullName,
            role:
              updatedComment.author.role,
            avatarUrl:
              updatedComment.author.avatarUrl,
            isAnonymized: false,
          },
        },
      },
    });
  });

/*
|--------------------------------------------------------------------------
| DELETE COMMENT
|--------------------------------------------------------------------------
*/

export const deleteComment =
  asyncHandler(async (req, res) => {
    const { comment, group } =
      await getCommentWithGroupOrThrow(
        req.params.commentId
      );

    await assertCanEngageOrThrow(
      group,
      req.user
    );

    assertCanModifyCommentOrThrow(
      comment,
      group,
      req.user
    );

    /*
    |--------------------------------------------------
    | Delete the comment and all replies
    |--------------------------------------------------
    */

    const replies =
      await PostComment.find({
        parentComment: comment._id,
      }).select(
        "_id isRemoved media"
      );

    // Replies hidden by moderation were already taken off
    // commentCount, so only count the visible ones.
    const visibleCommentCount =
      1 +
      replies.filter(
        (reply) => !reply.isRemoved
      ).length;

    const commentIds = [
      comment._id,
      ...replies.map(
        (reply) => reply._id
      ),
    ];

    /*
    |--------------------------------------------------
    | Keep the media before deleting MongoDB records.
    |--------------------------------------------------
    */

    const commentsWithMedia = [
      comment,
      ...replies,
    ];

    await Promise.all([
      PostComment.deleteMany({
        _id: {
          $in: commentIds,
        },
      }),

      CommentLike.deleteMany({
        comment: {
          $in: commentIds,
        },
      }),

      CommentReaction.deleteMany({
        comment: {
          $in: commentIds,
        },
      }),
    ]);

    /*
    |--------------------------------------------------
    | Remove comment/reply media from Cloudinary.
    |--------------------------------------------------
    */

    await deleteCommentMedia(
      commentsWithMedia
    );

    await Post.findByIdAndUpdate(
      comment.post,
      {
        $inc: {
          commentCount:
            -visibleCommentCount,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Comment deleted successfully",
      data: null,
    });
  });

/*
|--------------------------------------------------------------------------
| CREATE REPLY
|--------------------------------------------------------------------------
*/

export const createReply =
  asyncHandler(async (req, res) => {
    const {
      comment: parentComment,
      group,
    } = await getCommentWithGroupOrThrow(
      req.params.commentId
    );

    await assertCanEngageOrThrow(
      group,
      req.user
    );

    const content =
      req.body.content?.trim();

    if (!content) {
      throw new AppError(
        "Reply content is required",
        400
      );
    }

    /*
    |--------------------------------------------------
    | Make sure parent comment belongs to an
    | existing post
    |--------------------------------------------------
    */

    const post =
      await Post.findById(
        parentComment.post
      );

    if (!post) {
      throw new AppError(
        "Post was not found",
        404
      );
    }

    /*
    |--------------------------------------------------
    | Prevent reply-to-reply
    |
    | This keeps the structure:
    |
    | Comment
    |   ├── Reply
    |   ├── Reply
    |   └── Reply
    |
    | rather than unlimited nesting.
    |--------------------------------------------------
    */

    if (parentComment.parentComment) {
      throw new AppError(
        "Replies to replies are not allowed",
        400
      );
    }

    /*
    |--------------------------------------------------
    | Upload reply photos/videos
    |--------------------------------------------------
    */

    const mediaFiles =
      getCommentMediaFiles(req);

    const media =
      await uploadCommentMedia(
        mediaFiles
      );

    try {
      const reply =
        await PostComment.create({
          post: post._id,
          group: group._id,
          author: req.user._id,
          content,
          parentComment:
            parentComment._id,
          media,
        });

      await Post.findByIdAndUpdate(
        post._id,
        {
          $inc: {
            commentCount: 1,
          },
        }
      );

      /*
      |--------------------------------------------------
      | Notify users about the new reply
      |--------------------------------------------------
      */

      void notifyCommentReply({
        post,
        parentComment,
        reply,
        actorId: req.user._id,
      });

      const populatedReply =
        await populateCommentAuthor(
          PostComment.findById(
            reply._id
          )
        );

      return res.status(201).json({
        success: true,
        message: "Reply added successfully",
        data: {
          reply: {
            ...populatedReply.toSafeObject(),
            author: {
              id: populatedReply.author._id.toString(),
              fullName:
                populatedReply.author.fullName,
              role:
                populatedReply.author.role,
              avatarUrl:
                populatedReply.author.avatarUrl,
              isAnonymized: false,
            },
          },
        },
      });
    } catch (error) {
      /*
      |--------------------------------------------------
      | If MongoDB save fails after Cloudinary upload,
      | remove uploaded media.
      |--------------------------------------------------
      */

      await Promise.all(
        media.map((item) =>
          deleteCommentMediaFromCloudinary(
            item.publicId,
            item.type
          )
        )
      );

      throw error;
    }
  });

/*
|--------------------------------------------------------------------------
| TOGGLE COMMENT HEART
|--------------------------------------------------------------------------
*/

export const toggleCommentHeart =
  asyncHandler(async (req, res) => {
    const { comment, group } =
      await getCommentWithGroupOrThrow(
        req.params.commentId
      );

    await assertCanEngageOrThrow(
      group,
      req.user
    );

    const existingHeart =
      await CommentLike.findOne({
        comment: comment._id,
        user: req.user._id,
      });

    let liked;

    if (existingHeart) {
      await CommentLike.deleteOne({
        _id: existingHeart._id,
      });

      liked = false;
    } else {
      try {
        await CommentLike.create({
          comment: comment._id,
          user: req.user._id,
        });

        liked = true;
      } catch (error) {
        if (error?.code === 11000) {
          liked = true;
        } else {
          throw error;
        }
      }
    }

    const heartCount =
      await CommentLike.countDocuments({
        comment: comment._id,
      });

    return res.status(200).json({
      success: true,
      message: liked
        ? "Comment hearted successfully"
        : "Comment heart removed successfully",
      data: {
        liked,
        heartCount,
      },
    });
  });

/*
|--------------------------------------------------------------------------
| TOGGLE COMMENT / REPLY REACTION
|--------------------------------------------------------------------------
|
| Works for both comments and replies.
|
| Supported:
|   like
|   love
|   haha
|   wow
|   sad
|   angry
|
| If the user taps the same reaction again,
| the reaction is removed.
|
| If the user selects a different reaction,
| the existing reaction is changed.
|
|--------------------------------------------------------------------------
*/

export const toggleCommentReaction =
  asyncHandler(async (req, res) => {
    const { comment, group } =
      await getCommentWithGroupOrThrow(
        req.params.commentId
      );

    await assertCanEngageOrThrow(
      group,
      req.user
    );

    const reactionType =
      req.body.reactionType;

    if (
      !COMMENT_REACTION_TYPES.includes(
        reactionType
      )
    ) {
      throw new AppError(
        "Invalid reaction type",
        400
      );
    }

    const existingReaction =
      await CommentReaction.findOne({
        comment: comment._id,
        user: req.user._id,
      });

    /*
    |--------------------------------------------------
    | Same reaction clicked again
    | → remove reaction
    |--------------------------------------------------
    */

    if (
      existingReaction &&
      existingReaction.reactionType ===
        reactionType
    ) {
      await CommentReaction.deleteOne({
        _id: existingReaction._id,
      });

      const reactionData =
        await getCommentReactionData(
          comment._id,
          req.user._id
        );

      return res.status(200).json({
        success: true,
        message:
          "Reaction removed successfully",
        data: {
          reaction: null,
          ...reactionData,
        },
      });
    }

    /*
    |--------------------------------------------------
    | Change existing reaction
    |--------------------------------------------------
    */

    if (existingReaction) {
      existingReaction.reactionType =
        reactionType;

      await existingReaction.save();
    } else {
      /*
      |------------------------------------------------
      | Create new reaction
      |------------------------------------------------
      */

      try {
        await CommentReaction.create({
          comment: comment._id,
          user: req.user._id,
          reactionType,
        });
      } catch (error) {
        /*
        |----------------------------------------------
        | Protect against duplicate reaction
        |----------------------------------------------
        */

        if (error?.code === 11000) {
          const reaction =
            await CommentReaction.findOne({
              comment: comment._id,
              user: req.user._id,
            });

          if (reaction) {
            reaction.reactionType =
              reactionType;

            await reaction.save();
          }
        } else {
          throw error;
        }
      }
    }

    const reactionData =
      await getCommentReactionData(
        comment._id,
        req.user._id
      );

    return res.status(200).json({
      success: true,
      message:
        "Reaction updated successfully",
      data: {
        reaction: reactionType,
        ...reactionData,
      },
    });
  });