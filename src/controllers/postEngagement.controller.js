import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import CommentLike from "../models/CommentLike.js";
import SupportGroup from "../models/SupportGroup.js";
import GroupMembership from "../models/GroupMembership.js";

import { USER_ROLES } from "../constants/auth.constants.js";
import {
  GROUP_STATUS,
  GROUP_MEMBERSHIP_STATUS,
} from "../constants/group.constants.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const AUTHOR_SELECT_FIELDS =
  "fullName email role avatarUrl accountStatus";

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

  if (!post) {
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

  if (!comment) {
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

    const comment =
      await PostComment.create({
        post: post._id,
        group: group._id,
        author: req.user._id,
        content,
        parentComment: null,
      });

    await Post.findByIdAndUpdate(
      post._id,
      {
        $inc: {
          commentCount: 1,
        },
      }
    );

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
      }).select("_id");

    const commentIds = [
      comment._id,
      ...replies.map(
        (reply) => reply._id
      ),
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
    ]);

    await Post.findByIdAndUpdate(
      comment.post,
      {
        $inc: {
          commentCount:
            -commentIds.length,
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

    const reply =
      await PostComment.create({
        post: post._id,
        group: group._id,
        author: req.user._id,
        content,
        parentComment:
          parentComment._id,
      });

    await Post.findByIdAndUpdate(
      post._id,
      {
        $inc: {
          commentCount: 1,
        },
      }
    );

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