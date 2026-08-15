import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import SupportGroup from "../models/SupportGroup.js";
import GroupMembership from "../models/GroupMembership.js";

import { USER_ROLES } from "../constants/auth.constants.js";
import { GROUP_STATUS, GROUP_MEMBERSHIP_STATUS } from "../constants/group.constants.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const AUTHOR_SELECT_FIELDS = "fullName email role avatarUrl accountStatus";

const ANONYMOUS_AUTHOR = Object.freeze({
  id: null,
  fullName: "Anonymous",
  role: null,
  avatarUrl: null,
  isAnonymized: true,
});

const populatePostAuthor = (query) => {
  return query.populate({ path: "author", select: AUTHOR_SELECT_FIELDS });
};

const populateCommentAuthor = (query) => {
  return query.populate({ path: "author", select: AUTHOR_SELECT_FIELDS });
};

const getActiveGroupOrThrow = async (groupId) => {
  const group = await SupportGroup.findOne({
    _id: groupId,
    status: GROUP_STATUS.ACTIVE,
  });

  if (!group) {
    throw new AppError("Active support group was not found", 404);
  }

  return group;
};

const getActiveMembershipOrThrow = async (groupId, userId) => {
  const membership = await GroupMembership.findOne({
    group: groupId,
    user: userId,
    status: GROUP_MEMBERSHIP_STATUS.ACTIVE,
  });

  if (!membership) {
    throw new AppError(
      "You must be an active member of this group to do this",
      403
    );
  }

  return membership;
};

const isGroupStaffOrAdmin = (user, group) => {
  if (user.role === USER_ROLES.ADMIN) {
    return true;
  }

  if (user.role === USER_ROLES.MODERATOR) {
    return group.moderators.some((id) => id.toString() === user._id.toString());
  }

  if (user.role === USER_ROLES.PEER_SUPPORTER) {
    return group.peerSupporters.some((id) => id.toString() === user._id.toString());
  }

  return false;
};

const assertCanPostOrThrow = async (group, user) => {
  if (isGroupStaffOrAdmin(user, group)) {
    return;
  }

  await getActiveMembershipOrThrow(group._id, user._id);
};

const assertCanAccessGroupContentOrThrow = async (group, user) => {
  if (isGroupStaffOrAdmin(user, group)) {
    return;
  }

  const membership = await GroupMembership.findOne({
    group: group._id,
    user: user._id,
    status: GROUP_MEMBERSHIP_STATUS.ACTIVE,
  });

  if (!membership) {
    throw new AppError("You do not have access to this group's posts", 403);
  }
};

const assertCanDeleteOrThrow = (authorId, group, user) => {
  const isAuthor = authorId.toString() === user._id.toString();

  if (isAuthor || isGroupStaffOrAdmin(user, group)) {
    return;
  }

  throw new AppError("You do not have permission to delete this", 403);
};

const getPostWithGroupOrThrow = async (postId) => {
  const post = await populatePostAuthor(Post.findById(postId));

  if (!post) {
    throw new AppError("Post was not found", 404);
  }

  const group = await SupportGroup.findById(post.group);

  if (!group) {
    throw new AppError("Support group was not found", 404);
  }

  return { post, group };
};

const getCommentWithGroupOrThrow = async (commentId) => {
  const comment = await PostComment.findById(commentId);

  if (!comment) {
    throw new AppError("Comment was not found", 404);
  }

  const group = await SupportGroup.findById(comment.group);

  if (!group) {
    throw new AppError("Support group was not found", 404);
  }

  return { comment, group };
};

const formatAuthorSummary = (author) => ({
  id: author._id.toString(),
  fullName: author.fullName,
  role: author.role,
  avatarUrl: author.avatarUrl,
  isAnonymized: false,
});

const redactPostAuthor = (post, viewerUser, group) => {
  const isAuthor = post.author._id.toString() === viewerUser._id.toString();

  if (!post.isAnonymous || isAuthor || isGroupStaffOrAdmin(viewerUser, group)) {
    return formatAuthorSummary(post.author);
  }

  return ANONYMOUS_AUTHOR;
};

const buildPostResponse = (post, viewerUser, group, likedPostIdSet) => ({
  ...post.toSafeObject(),
  author: redactPostAuthor(post, viewerUser, group),
  likedByMe: likedPostIdSet.has(post._id.toString()),
});

/*
|--------------------------------------------------------------------------
| CREATE POST
|--------------------------------------------------------------------------
*/

export const createPost = asyncHandler(async (req, res) => {
  const group = await getActiveGroupOrThrow(req.params.groupId);

  await assertCanPostOrThrow(group, req.user);

  const post = await Post.create({
    group: group._id,
    author: req.user._id,
    content: req.body.content.trim(),
    isAnonymous: Boolean(req.body.isAnonymous),
  });

  const populatedPost = await populatePostAuthor(Post.findById(post._id));

  return res.status(201).json({
    success: true,
    message: "Post created successfully",
    data: {
      post: buildPostResponse(populatedPost, req.user, group, new Set()),
    },
  });
});

/*
|--------------------------------------------------------------------------
| MY FEED (posts from all my joined groups, combined)
|--------------------------------------------------------------------------
*/

export const getMyFeed = asyncHandler(async (req, res) => {
  const memberships = await GroupMembership.find({
    user: req.user._id,
    status: GROUP_MEMBERSHIP_STATUS.ACTIVE,
  }).select("group");

  const groupIds = memberships.map((membership) => membership.group);

  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const skip = (page - 1) * limit;

  const filter = { group: { $in: groupIds } };

  const [posts, totalPosts, groups] = await Promise.all([
    populatePostAuthor(
      Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
    ),

    Post.countDocuments(filter),

    SupportGroup.find({ _id: { $in: groupIds } }),
  ]);

  const groupMap = new Map(
    groups.map((group) => [group._id.toString(), group])
  );

  const likes = await PostLike.find({
    post: { $in: posts.map((post) => post._id) },
    user: req.user._id,
  });

  const likedPostIdSet = new Set(likes.map((like) => like.post.toString()));

  const totalPages = Math.max(1, Math.ceil(totalPosts / limit));

  return res.status(200).json({
    success: true,
    message: "Feed retrieved successfully",
    data: {
      posts: posts
        .filter((post) => groupMap.has(post.group.toString()))
        .map((post) => {
          const group = groupMap.get(post.group.toString());

          return {
            ...buildPostResponse(post, req.user, group, likedPostIdSet),
            groupName: group.name,
          };
        }),

      pagination: {
        page,
        limit,
        totalPosts,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    },
  });
});

/*
|--------------------------------------------------------------------------
| LIST GROUP POSTS
|--------------------------------------------------------------------------
*/

export const getGroupPosts = asyncHandler(async (req, res) => {
  const group = await getActiveGroupOrThrow(req.params.groupId);

  await assertCanAccessGroupContentOrThrow(group, req.user);

  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const skip = (page - 1) * limit;

  const [posts, totalPosts] = await Promise.all([
    populatePostAuthor(
      Post.find({ group: group._id })
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ),

    Post.countDocuments({ group: group._id }),
  ]);

  const likes = await PostLike.find({
    post: { $in: posts.map((post) => post._id) },
    user: req.user._id,
  });

  const likedPostIdSet = new Set(likes.map((like) => like.post.toString()));

  const totalPages = Math.max(1, Math.ceil(totalPosts / limit));

  return res.status(200).json({
    success: true,
    message: "Posts retrieved successfully",
    data: {
      posts: posts.map((post) =>
        buildPostResponse(post, req.user, group, likedPostIdSet)
      ),

      pagination: {
        page,
        limit,
        totalPosts,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    },
  });
});

/*
|--------------------------------------------------------------------------
| GET POST BY ID
|--------------------------------------------------------------------------
*/

export const getPostById = asyncHandler(async (req, res) => {
  const { post, group } = await getPostWithGroupOrThrow(req.params.postId);

  await assertCanAccessGroupContentOrThrow(group, req.user);

  const existingLike = await PostLike.findOne({
    post: post._id,
    user: req.user._id,
  });

  const likedPostIdSet = new Set(existingLike ? [post._id.toString()] : []);

  return res.status(200).json({
    success: true,
    message: "Post retrieved successfully",
    data: {
      post: buildPostResponse(post, req.user, group, likedPostIdSet),
    },
  });
});

/*
|--------------------------------------------------------------------------
| DELETE POST
|--------------------------------------------------------------------------
*/

export const deletePost = asyncHandler(async (req, res) => {
  const { post, group } = await getPostWithGroupOrThrow(req.params.postId);

  assertCanDeleteOrThrow(post.author._id, group, req.user);

  await Promise.all([
    Post.deleteOne({ _id: post._id }),
    PostComment.deleteMany({ post: post._id }),
    PostLike.deleteMany({ post: post._id }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Post deleted successfully",
    data: null,
  });
});

/*
|--------------------------------------------------------------------------
| TOGGLE PIN
|--------------------------------------------------------------------------
*/

export const togglePostPin = asyncHandler(async (req, res) => {
  const { post, group } = await getPostWithGroupOrThrow(req.params.postId);

  if (!isGroupStaffOrAdmin(req.user, group)) {
    throw new AppError("You do not have permission to pin this post", 403);
  }

  const updatedPost = await Post.findByIdAndUpdate(
    post._id,
    { isPinned: !post.isPinned },
    { new: true }
  );

  return res.status(200).json({
    success: true,
    message: updatedPost.isPinned
      ? "Post pinned successfully"
      : "Post unpinned successfully",
    data: {
      isPinned: updatedPost.isPinned,
    },
  });
});

/*
|--------------------------------------------------------------------------
| TOGGLE LIKE
|--------------------------------------------------------------------------
*/

export const togglePostLike = asyncHandler(async (req, res) => {
  const { post, group } = await getPostWithGroupOrThrow(req.params.postId);

  await assertCanPostOrThrow(group, req.user);

  const existingLike = await PostLike.findOne({
    post: post._id,
    user: req.user._id,
  });

  let liked;

  if (existingLike) {
    await PostLike.deleteOne({ _id: existingLike._id });
    await Post.findByIdAndUpdate(post._id, { $inc: { likeCount: -1 } });
    liked = false;
  } else {
    try {
      await PostLike.create({ post: post._id, user: req.user._id });
      await Post.findByIdAndUpdate(post._id, { $inc: { likeCount: 1 } });
      liked = true;
    } catch (error) {
      if (error?.code === 11000) {
        liked = true;
      } else {
        throw error;
      }
    }
  }

  const updatedPost = await Post.findById(post._id);

  return res.status(200).json({
    success: true,
    message: liked ? "Post liked successfully" : "Post unliked successfully",
    data: {
      liked,
      likeCount: updatedPost.likeCount,
    },
  });
});

/*
|--------------------------------------------------------------------------
| LIST COMMENTS
|--------------------------------------------------------------------------
*/

export const getPostComments = asyncHandler(async (req, res) => {
  const { post, group } = await getPostWithGroupOrThrow(req.params.postId);

  await assertCanAccessGroupContentOrThrow(group, req.user);

  const comments = await populateCommentAuthor(
    PostComment.find({ post: post._id }).sort({ createdAt: 1 })
  );

  return res.status(200).json({
    success: true,
    message: "Comments retrieved successfully",
    data: {
      comments: comments.map((comment) => ({
        ...comment.toSafeObject(),
        author: formatAuthorSummary(comment.author),
      })),

      totalComments: comments.length,
    },
  });
});

/*
|--------------------------------------------------------------------------
| CREATE COMMENT
|--------------------------------------------------------------------------
*/

export const createComment = asyncHandler(async (req, res) => {
  const { post, group } = await getPostWithGroupOrThrow(req.params.postId);

  await assertCanPostOrThrow(group, req.user);

  const comment = await PostComment.create({
    post: post._id,
    group: group._id,
    author: req.user._id,
    content: req.body.content.trim(),
  });

  await Post.findByIdAndUpdate(post._id, { $inc: { commentCount: 1 } });

  const populatedComment = await populateCommentAuthor(
    PostComment.findById(comment._id)
  );

  return res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: {
      comment: {
        ...populatedComment.toSafeObject(),
        author: formatAuthorSummary(populatedComment.author),
      },
    },
  });
});

/*
|--------------------------------------------------------------------------
| DELETE COMMENT
|--------------------------------------------------------------------------
*/

export const deleteComment = asyncHandler(async (req, res) => {
  const { comment, group } = await getCommentWithGroupOrThrow(
    req.params.commentId
  );

  assertCanDeleteOrThrow(comment.author, group, req.user);

  await PostComment.deleteOne({ _id: comment._id });

  await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });

  return res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
    data: null,
  });
});
