import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import SupportGroup from "../models/SupportGroup.js";
import GroupMembership from "../models/GroupMembership.js";

import { USER_ROLES } from "../constants/auth.constants.js";
import { GROUP_STATUS, GROUP_MEMBERSHIP_STATUS } from "../constants/group.constants.js";
import { CONTENT_WARNING, POST_SORT } from "../constants/post.constants.js";

import { detectCrisisContent } from "../services/contentSafety.service.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const AUTHOR_SELECT_FIELDS = "fullName email role avatarUrl accountStatus";

const ANONYMOUS_AUTHOR = Object.freeze({
  id: null,
  fullName: "Anonymous",
  role: null,
  avatarUrl: null,
  isAnonymized: true,
  staffBadge: null,
});

/*
 * Makes user input safe to use inside a RegExp,
 * e.g. "why?" or "(help)" are searched literally.
 */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*
 * Pinned posts are lifted to the top only in the default feed
 * (newest, not searching). Other sorts and search results are
 * ordered purely by what the user asked for.
 */
const buildPostSort = (sortOption, isSearching) => {
  switch (sortOption) {
    case POST_SORT.MOST_SUPPORTED:
      return { likeCount: -1, commentCount: -1, createdAt: -1 };

    case POST_SORT.MOST_DISCUSSED:
      return { commentCount: -1, likeCount: -1, createdAt: -1 };

    case POST_SORT.UNANSWERED:
      return { createdAt: -1 };

    default:
      return isSearching
        ? { createdAt: -1 }
        : { isPinned: -1, createdAt: -1 };
  }
};

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

/*
 * "PEER_SUPPORTER" | "MODERATOR" | "ADMIN" when the author is staff of
 * THIS group (or an admin), otherwise null. Anonymous posts never get a
 * badge, so a badge cannot narrow down who wrote them.
 */
const getAuthorStaffBadge = (post, group) => {
  if (post.isAnonymous) {
    return null;
  }

  return isGroupStaffOrAdmin(post.author, group) ? post.author.role : null;
};

const redactPostAuthor = (post, viewerUser, group) => {
  const isAuthor = post.author._id.toString() === viewerUser._id.toString();

  if (!post.isAnonymous || isAuthor || isGroupStaffOrAdmin(viewerUser, group)) {
    return {
      ...formatAuthorSummary(post.author),
      staffBadge: getAuthorStaffBadge(post, group),
    };
  }

  return ANONYMOUS_AUTHOR;
};

const formatCrisisFlag = (crisisFlag) => ({
  isFlagged: true,
  matchedTerms: crisisFlag.matchedTerms,
  flaggedAt: crisisFlag.flaggedAt,
  isHandled: Boolean(crisisFlag.handledAt),
  handledBy: crisisFlag.handledBy ? crisisFlag.handledBy.toString() : null,
  handledAt: crisisFlag.handledAt,
});

/*
 * Crisis flags are shown to group staff only. The author and other
 * members never see that a post was flagged.
 */
const buildCrisisFlagForViewer = (post, viewerUser, group) => {
  if (!post.crisisFlag?.isFlagged || !isGroupStaffOrAdmin(viewerUser, group)) {
    return null;
  }

  return formatCrisisFlag(post.crisisFlag);
};

const buildPostResponse = (post, viewerUser, group, likedPostIdSet) => ({
  ...post.toSafeObject(),
  author: redactPostAuthor(post, viewerUser, group),
  likedByMe: likedPostIdSet.has(post._id.toString()),
  crisisFlag: buildCrisisFlagForViewer(post, viewerUser, group),
});

/*
 * Groups whose crisis alerts the user is allowed to see.
 * Returns null for admins, meaning "all groups".
 */
const getStaffGroupIds = async (user) => {
  if (user.role === USER_ROLES.ADMIN) {
    return null;
  }

  const filter =
    user.role === USER_ROLES.MODERATOR
      ? { moderators: user._id }
      : { peerSupporters: user._id };

  const groups = await SupportGroup.find(filter).select("_id");

  return groups.map((group) => group._id);
};

/*
 * Mongo filter for the "group" field of a staff list endpoint.
 * Returns undefined when an admin asks for all groups.
 */
const buildStaffGroupFilter = (staffGroupIds, requestedGroupId) => {
  if (requestedGroupId) {
    const canSeeGroup =
      staffGroupIds === null ||
      staffGroupIds.some((id) => id.toString() === requestedGroupId);

    if (!canSeeGroup) {
      throw new AppError("You are not assigned to this group", 403);
    }

    return requestedGroupId;
  }

  return staffGroupIds === null ? undefined : { $in: staffGroupIds };
};

/*
 * Builds post responses for lists that span several groups,
 * adding each post's groupName and the viewer's like state.
 */
const buildPostsWithGroupNames = async (posts, viewerUser) => {
  if (posts.length === 0) {
    return [];
  }

  const [groups, likes] = await Promise.all([
    SupportGroup.find({
      _id: { $in: [...new Set(posts.map((post) => post.group.toString()))] },
    }),

    PostLike.find({
      post: { $in: posts.map((post) => post._id) },
      user: viewerUser._id,
    }),
  ]);

  const groupMap = new Map(
    groups.map((group) => [group._id.toString(), group])
  );

  const likedPostIdSet = new Set(likes.map((like) => like.post.toString()));

  return posts
    .filter((post) => groupMap.has(post.group.toString()))
    .map((post) => {
      const group = groupMap.get(post.group.toString());

      return {
        ...buildPostResponse(post, viewerUser, group, likedPostIdSet),
        groupName: group.name,
      };
    });
};

/*
|--------------------------------------------------------------------------
| CREATE POST
|--------------------------------------------------------------------------
*/

export const createPost = asyncHandler(async (req, res) => {
  const group = await getActiveGroupOrThrow(req.params.groupId);

  await assertCanPostOrThrow(group, req.user);

  const content = req.body.content.trim();

  const crisisCheck = detectCrisisContent(content);

  /*
   * Crisis posts always get a suicide/self-harm warning, even if the
   * author did not add one, so other members are not exposed to it
   * without choosing to read it.
   */
  const contentWarnings = new Set(req.body.contentWarnings ?? []);

  if (crisisCheck.isCrisis) {
    contentWarnings.add(CONTENT_WARNING.SUICIDE_SELF_HARM);
  }

  const post = await Post.create({
    group: group._id,
    author: req.user._id,
    content,
    isAnonymous: Boolean(req.body.isAnonymous),
    contentWarnings: [...contentWarnings],

    crisisFlag: crisisCheck.isCrisis
      ? {
          isFlagged: true,
          matchedTerms: crisisCheck.matchedTerms,
          flaggedAt: new Date(),
        }
      : undefined,
  });

  const populatedPost = await populatePostAuthor(Post.findById(post._id));

  return res.status(201).json({
    success: true,
    message: "Post created successfully",
    data: {
      post: buildPostResponse(populatedPost, req.user, group, new Set()),

      /*
       * Tells the app to show the author crisis support resources.
       * Matched terms are not sent back to the author.
       */
      safety: {
        crisisDetected: crisisCheck.isCrisis,
      },
    },
  });
});

/*
|--------------------------------------------------------------------------
| CRISIS ALERTS (group staff)
|--------------------------------------------------------------------------
|
| status=open (default) → flagged posts nobody has handled yet
| status=handled        → flagged posts already handled
| status=all            → both
|
*/

export const getCrisisAlerts = asyncHandler(async (req, res) => {
  const status = req.query.status || "open";
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const skip = (page - 1) * limit;

  const staffGroupIds = await getStaffGroupIds(req.user);

  const filter = { "crisisFlag.isFlagged": true };

  if (status === "open") {
    filter["crisisFlag.handledAt"] = null;
  } else if (status === "handled") {
    filter["crisisFlag.handledAt"] = { $ne: null };
  }

  const groupFilter = buildStaffGroupFilter(staffGroupIds, req.query.groupId);

  if (groupFilter) {
    filter.group = groupFilter;
  }

  const [posts, totalPosts] = await Promise.all([
    populatePostAuthor(
      Post.find(filter)
        .sort({ "crisisFlag.flaggedAt": -1 })
        .skip(skip)
        .limit(limit)
    ),

    Post.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalPosts / limit));

  return res.status(200).json({
    success: true,
    message: "Crisis alerts retrieved successfully",
    data: {
      posts: await buildPostsWithGroupNames(posts, req.user),

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
| NEEDS A RESPONSE QUEUE (group staff)
|--------------------------------------------------------------------------
|
| crisisAlerts → open crisis alerts, newest first (always shown in full,
|                up to CRISIS_QUEUE_LIMIT)
| unanswered   → posts with no comments from the last
|                NEEDS_RESPONSE_MAX_AGE_DAYS, oldest first so the person
|                who has waited longest is helped first. Paginated.
|
| Posts written by the viewer are left out, and open crisis posts appear
| only in crisisAlerts so nothing is listed twice.
|
*/

const NEEDS_RESPONSE_MAX_AGE_DAYS = 14;
const CRISIS_QUEUE_LIMIT = 50;

export const getNeedsResponseQueue = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const skip = (page - 1) * limit;

  const staffGroupIds = await getStaffGroupIds(req.user);
  const groupFilter = buildStaffGroupFilter(staffGroupIds, req.query.groupId);

  const baseFilter = {
    author: { $ne: req.user._id },
    ...(groupFilter ? { group: groupFilter } : {}),
  };

  const crisisFilter = {
    ...baseFilter,
    "crisisFlag.isFlagged": true,
    "crisisFlag.handledAt": null,
  };

  const oldestDate = new Date(
    Date.now() - NEEDS_RESPONSE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  );

  const unansweredFilter = {
    ...baseFilter,
    commentCount: 0,
    createdAt: { $gte: oldestDate },
    $nor: [
      {
        "crisisFlag.isFlagged": true,
        "crisisFlag.handledAt": null,
      },
    ],
  };

  const [crisisPosts, totalCrisisAlerts, unansweredPosts, totalUnanswered] =
    await Promise.all([
      populatePostAuthor(
        Post.find(crisisFilter)
          .sort({ "crisisFlag.flaggedAt": -1 })
          .limit(CRISIS_QUEUE_LIMIT)
      ),

      Post.countDocuments(crisisFilter),

      populatePostAuthor(
        Post.find(unansweredFilter)
          .sort({ createdAt: 1 })
          .skip(skip)
          .limit(limit)
      ),

      Post.countDocuments(unansweredFilter),
    ]);

  const [crisisAlerts, unanswered] = await Promise.all([
    buildPostsWithGroupNames(crisisPosts, req.user),
    buildPostsWithGroupNames(unansweredPosts, req.user),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalUnanswered / limit));

  return res.status(200).json({
    success: true,
    message: "Needs-response queue retrieved successfully",
    data: {
      crisisAlerts,
      unanswered,

      counts: {
        crisisAlerts: totalCrisisAlerts,
        unanswered: totalUnanswered,
      },

      maxAgeDays: NEEDS_RESPONSE_MAX_AGE_DAYS,

      pagination: {
        page,
        limit,
        totalPosts: totalUnanswered,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    },
  });
});

/*
|--------------------------------------------------------------------------
| MARK CRISIS ALERT AS HANDLED (group staff)
|--------------------------------------------------------------------------
*/

export const markCrisisAlertHandled = asyncHandler(async (req, res) => {
  const { post, group } = await getPostWithGroupOrThrow(req.params.postId);

  if (!isGroupStaffOrAdmin(req.user, group)) {
    throw new AppError(
      "You do not have permission to handle this crisis alert",
      403
    );
  }

  if (!post.crisisFlag?.isFlagged) {
    throw new AppError("This post does not have a crisis alert", 400);
  }

  if (!post.crisisFlag.handledAt) {
    post.crisisFlag.handledBy = req.user._id;
    post.crisisFlag.handledAt = new Date();

    await post.save();
  }

  return res.status(200).json({
    success: true,
    message: "Crisis alert marked as handled",
    data: {
      crisisFlag: formatCrisisFlag(post.crisisFlag),
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

  const searchText = req.query.q?.trim() ?? "";
  const isSearching = searchText.length > 0;

  const filter = { group: group._id };

  /*
   * Searches post content only — never author names, so searching
   * cannot reveal who wrote an anonymous post.
   */
  if (isSearching) {
    filter.content = { $regex: escapeRegex(searchText), $options: "i" };
  }

  const sortOption = req.query.sort || POST_SORT.NEWEST;

  /*
   * Unanswered = no comments yet, so members and peer supporters
   * can find posts that nobody has replied to.
   */
  if (sortOption === POST_SORT.UNANSWERED) {
    filter.commentCount = 0;
  }

  const sort = buildPostSort(sortOption, isSearching);

  const [posts, totalPosts] = await Promise.all([
    populatePostAuthor(
      Post.find(filter).sort(sort).skip(skip).limit(limit)
    ),

    Post.countDocuments(filter),
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
