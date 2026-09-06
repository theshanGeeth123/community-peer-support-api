import GlobalPost from "../models/GlobalPost.js";
import GlobalPostComment from "../models/GlobalPostComment.js";
import GlobalPostLike from "../models/GlobalPostLike.js";

import { USER_ROLES } from "../constants/auth.constants.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const AUTHOR_SELECT_FIELDS = "fullName email role avatarUrl accountStatus";

const canModerateWall = (user) =>
  user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.MODERATOR;

const populatePostAuthor = (query) => {
  return query.populate({ path: "author", select: AUTHOR_SELECT_FIELDS });
};

const populateCommentAuthor = (query) => {
  return query.populate({ path: "author", select: AUTHOR_SELECT_FIELDS });
};

const formatAuthorSummary = (author) => ({
  id: author._id.toString(),
  fullName: author.fullName,
  role: author.role,
  avatarUrl: author.avatarUrl,
});

const assertCanDeleteOrThrow = (authorId, user) => {
  const isAuthor = authorId.toString() === user._id.toString();

  if (isAuthor || canModerateWall(user)) {
    return;
  }

  throw new AppError("You do not have permission to delete this", 403);
};

const getPostOrThrow = async (postId) => {
  const post = await populatePostAuthor(GlobalPost.findById(postId));

  if (!post) {
    throw new AppError("Post was not found", 404);
  }

  return post;
};

const getCommentOrThrow = async (commentId) => {
  const comment = await GlobalPostComment.findById(commentId);

  if (!comment) {
    throw new AppError("Comment was not found", 404);
  }

  return comment;
};

const buildPostResponse = (post, likedPostIdSet) => ({
  ...post.toSafeObject(),
  author: formatAuthorSummary(post.author),
  likedByMe: likedPostIdSet.has(post._id.toString()),
});

/*
|--------------------------------------------------------------------------
| CREATE POST
|--------------------------------------------------------------------------
*/

export const createGlobalPost = asyncHandler(async (req, res) => {
  const isPinned = canModerateWall(req.user) ? Boolean(req.body.isPinned) : false;

  const post = await GlobalPost.create({
    author: req.user._id,
    content: req.body.content.trim(),
    postType: req.body.postType === "announcement" ? "announcement" : "post",
    isPinned,
  });

  const populatedPost = await populatePostAuthor(GlobalPost.findById(post._id));

  return res.status(201).json({
    success: true,
    message: "Post created successfully",
    data: {
      post: buildPostResponse(populatedPost, new Set()),
    },
  });
});

/*
|--------------------------------------------------------------------------
| LIST FEED
|--------------------------------------------------------------------------
*/

export const getGlobalFeed = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const skip = (page - 1) * limit;

  const [posts, totalPosts] = await Promise.all([
    populatePostAuthor(
      GlobalPost.find()
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ),

    GlobalPost.countDocuments(),
  ]);

  const likes = await GlobalPostLike.find({
    post: { $in: posts.map((post) => post._id) },
    user: req.user._id,
  });

  const likedPostIdSet = new Set(likes.map((like) => like.post.toString()));

  const totalPages = Math.max(1, Math.ceil(totalPosts / limit));

  return res.status(200).json({
    success: true,
    message: "Community feed retrieved successfully",
    data: {
      posts: posts.map((post) => buildPostResponse(post, likedPostIdSet)),

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

export const getGlobalPostById = asyncHandler(async (req, res) => {
  const post = await getPostOrThrow(req.params.postId);

  const existingLike = await GlobalPostLike.findOne({
    post: post._id,
    user: req.user._id,
  });

  const likedPostIdSet = new Set(existingLike ? [post._id.toString()] : []);

  return res.status(200).json({
    success: true,
    message: "Post retrieved successfully",
    data: {
      post: buildPostResponse(post, likedPostIdSet),
    },
  });
});

/*
|--------------------------------------------------------------------------
| DELETE POST
|--------------------------------------------------------------------------
*/

export const deleteGlobalPost = asyncHandler(async (req, res) => {
  const post = await getPostOrThrow(req.params.postId);

  assertCanDeleteOrThrow(post.author._id, req.user);

  await Promise.all([
    GlobalPost.deleteOne({ _id: post._id }),
    GlobalPostComment.deleteMany({ post: post._id }),
    GlobalPostLike.deleteMany({ post: post._id }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Post deleted successfully",
    data: null,
  });
});

/*
|--------------------------------------------------------------------------
| TOGGLE LIKE
|--------------------------------------------------------------------------
*/

export const toggleGlobalPostLike = asyncHandler(async (req, res) => {
  const post = await getPostOrThrow(req.params.postId);

  const existingLike = await GlobalPostLike.findOne({
    post: post._id,
    user: req.user._id,
  });

  let liked;

  if (existingLike) {
    await GlobalPostLike.deleteOne({ _id: existingLike._id });
    await GlobalPost.findByIdAndUpdate(post._id, { $inc: { likeCount: -1 } });
    liked = false;
  } else {
    try {
      await GlobalPostLike.create({ post: post._id, user: req.user._id });
      await GlobalPost.findByIdAndUpdate(post._id, { $inc: { likeCount: 1 } });
      liked = true;
    } catch (error) {
      if (error?.code === 11000) {
        liked = true;
      } else {
        throw error;
      }
    }
  }

  const updatedPost = await GlobalPost.findById(post._id);

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

export const getGlobalPostComments = asyncHandler(async (req, res) => {
  await getPostOrThrow(req.params.postId);

  const comments = await populateCommentAuthor(
    GlobalPostComment.find({ post: req.params.postId }).sort({
      createdAt: 1,
    })
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

export const createGlobalPostComment = asyncHandler(async (req, res) => {
  const post = await getPostOrThrow(req.params.postId);

  const comment = await GlobalPostComment.create({
    post: post._id,
    author: req.user._id,
    content: req.body.content.trim(),
  });

  await GlobalPost.findByIdAndUpdate(post._id, { $inc: { commentCount: 1 } });

  const populatedComment = await populateCommentAuthor(
    GlobalPostComment.findById(comment._id)
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

export const deleteGlobalPostComment = asyncHandler(async (req, res) => {
  const comment = await getCommentOrThrow(req.params.commentId);

  assertCanDeleteOrThrow(comment.author, req.user);

  await GlobalPostComment.deleteOne({ _id: comment._id });

  await GlobalPost.findByIdAndUpdate(comment.post, {
    $inc: { commentCount: -1 },
  });

  return res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
    data: null,
  });
});
