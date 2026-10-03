import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import PostReaction from "../models/PostReaction.js";
import CommentReaction from "../models/CommentReaction.js";
import SupportGroup from "../models/SupportGroup.js";
import GroupMembership from "../models/GroupMembership.js";

import { USER_ROLES } from "../constants/auth.constants.js";
import {
  GROUP_STATUS,
  GROUP_MEMBERSHIP_STATUS,
} from "../constants/group.constants.js";
import {
  AI_SAFETY_STATUS,
  CONTENT_WARNING,
  CRISIS_FLAG_SOURCE,
  POST_LANGUAGE,
  POST_SORT,
  TRANSLATION_LANGUAGE,
} from "../constants/post.constants.js";

import { isAiSafetyEnabled } from "../services/aiSafety.service.js";
import { detectCrisisContent } from "../services/contentSafety.service.js";
import {
  reviewPostWithAi,
  waitUpTo,
} from "../services/postSafetyReview.service.js";
import { detectLanguageByScript } from "../services/postLanguage.service.js";
import {
  findSavedTranslation,
  getOrCreatePostTranslation,
} from "../services/postTranslation.service.js";
import { NOT_REMOVED } from "../services/moderationRemoval.service.js";
import {
  deletePostImageFromCloudinary,
  uploadPostImageToCloudinary,
} from "../services/postImage.service.js";
import {
  deleteNotificationsForPost,
  notifyPostLike,
  removePostLikeNotification,
} from "../services/notification.service.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const AUTHOR_SELECT_FIELDS =
  "fullName email role avatarUrl accountStatus";

const ANONYMOUS_AUTHOR = Object.freeze({
  id: null,
  fullName: "Anonymous",
  role: null,
  avatarUrl: null,
  isAnonymized: true,
  staffBadge: null,
});

const POST_REACTION_TYPES = Object.freeze([
  "like",
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
]);

const escapeRegex = (text) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildPostSort = (sortOption, isSearching) => {
  switch (sortOption) {
    case POST_SORT.MOST_SUPPORTED:
      return {
        likeCount: -1,
        commentCount: -1,
        createdAt: -1,
      };

    case POST_SORT.MOST_DISCUSSED:
      return {
        commentCount: -1,
        likeCount: -1,
        createdAt: -1,
      };

    case POST_SORT.UNANSWERED:
      return {
        createdAt: -1,
      };

    default:
      return isSearching
        ? { createdAt: -1 }
        : {
            isPinned: -1,
            createdAt: -1,
          };
  }
};

const populatePostAuthor = (query) => {
  return query.populate({
    path: "author",
    select: AUTHOR_SELECT_FIELDS,
  });
};

const populateCommentAuthor = (query) => {
  return query.populate({
    path: "author",
    select: AUTHOR_SELECT_FIELDS,
  });
};

const getActiveGroupOrThrow = async (groupId) => {
  const group = await SupportGroup.findOne({
    _id: groupId,
    status: GROUP_STATUS.ACTIVE,
  });

  if (!group) {
    throw new AppError(
      "Active support group was not found",
      404
    );
  }

  return group;
};

const getActiveMembershipOrThrow = async (
  groupId,
  userId
) => {
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

const assertCanPostOrThrow = async (
  group,
  user
) => {
  if (isGroupStaffOrAdmin(user, group)) {
    return;
  }

  await getActiveMembershipOrThrow(
    group._id,
    user._id
  );
};

const assertCanAccessGroupContentOrThrow =
  async (group, user) => {
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
        "You do not have access to this group's posts",
        403
      );
    }
  };

const assertCanDeleteOrThrow = (
  authorId,
  group,
  user
) => {
  const isAuthor =
    authorId.toString() ===
    user._id.toString();

  if (
    isAuthor ||
    isGroupStaffOrAdmin(user, group)
  ) {
    return;
  }

  throw new AppError(
    "You do not have permission to delete this",
    403
  );
};

const getPostWithGroupOrThrow = async (
  postId,
  { allowRemoved = false } = {}
) => {
  const post = await populatePostAuthor(
    Post.findById(postId)
  );

  if (!post || (post.isRemoved && !allowRemoved)) {
    throw new AppError("Post was not found", 404);
  }

  const group =
    await SupportGroup.findById(post.group);

  if (!group) {
    throw new AppError(
      "Support group was not found",
      404
    );
  }

  return {
    post,
    group,
  };
};

const getCommentWithGroupOrThrow =
  async (commentId) => {
    const comment =
      await PostComment.findById(commentId);

    if (!comment) {
      throw new AppError(
        "Comment was not found",
        404
      );
    }

    const group =
      await SupportGroup.findById(
        comment.group
      );

    if (!group) {
      throw new AppError(
        "Support group was not found",
        404
      );
    }

    return {
      comment,
      group,
    };
  };

const formatAuthorSummary = (author) => ({
  id: author._id.toString(),
  fullName: author.fullName,
  role: author.role,
  avatarUrl: author.avatarUrl,
  isAnonymized: false,
});

const getAuthorStaffBadge = (post, group) => {
  if (post.isAnonymous) {
    return null;
  }

  return isGroupStaffOrAdmin(post.author, group)
    ? post.author.role
    : null;
};

const redactPostAuthor = (
  post,
  viewerUser,
  group
) => {
  const isAuthor =
    post.author._id.toString() ===
    viewerUser._id.toString();

  if (
    !post.isAnonymous ||
    isAuthor ||
    isGroupStaffOrAdmin(
      viewerUser,
      group
    )
  ) {
    return {
      ...formatAuthorSummary(post.author),
      staffBadge: getAuthorStaffBadge(post, group),
    };
  }

  return ANONYMOUS_AUTHOR;
};

/*
 * How long createPost waits for the AI safety check before replying.
 * Usually the check finishes in time, so the author can be shown
 * support resources straight away. If it is slower, the reply goes out
 * anyway and the check finishes in the background.
 */
const AI_SAFETY_INLINE_WAIT_MS =
  Number(process.env.AI_SAFETY_INLINE_WAIT_MS) || 2500;

/*
 * The AI's view of the post, for staff. null when there is no AI
 * result (still running, failed, or AI not configured).
 */
const formatAiAssessment = (aiSafety) => {
  if (aiSafety?.status !== AI_SAFETY_STATUS.DONE) {
    return null;
  }

  return {
    riskLevel: aiSafety.riskLevel,
    reason: aiSafety.reason,
    mood: aiSafety.mood,
    checkedAt: aiSafety.checkedAt,
  };
};

const formatCrisisFlag = (post) => {
  const { crisisFlag } = post;

  return {
    isFlagged: true,
    matchedTerms: crisisFlag.matchedTerms,
    flaggedAt: crisisFlag.flaggedAt,
    isHandled: Boolean(crisisFlag.handledAt),
    handledBy: crisisFlag.handledBy
      ? crisisFlag.handledBy.toString()
      : null,
    handledAt: crisisFlag.handledAt,

    /*
     * KEYWORD | AI | BOTH — null on posts flagged before the AI check.
     */
    source: crisisFlag.source ?? null,
    aiStatus: post.aiSafety?.status ?? null,
    ai: formatAiAssessment(post.aiSafety),
  };
};

const buildCrisisFlagForViewer = (
  post,
  viewerUser,
  group
) => {
  if (
    !post.crisisFlag?.isFlagged ||
    !isGroupStaffOrAdmin(
      viewerUser,
      group
    )
  ) {
    return null;
  }

  return formatCrisisFlag(post);
};

const getStaffGroupIds = async (user) => {
  if (user.role === USER_ROLES.ADMIN) {
    return null;
  }

  const filter =
    user.role === USER_ROLES.MODERATOR
      ? { moderators: user._id }
      : { peerSupporters: user._id };

  const groups = await SupportGroup.find(
    filter
  ).select("_id");

  return groups.map(
    (group) => group._id
  );
};

const buildStaffGroupFilter = (
  staffGroupIds,
  requestedGroupId
) => {
  if (requestedGroupId) {
    const canSeeGroup =
      staffGroupIds === null ||
      staffGroupIds.some(
        (id) =>
          id.toString() ===
          requestedGroupId
      );

    if (!canSeeGroup) {
      throw new AppError(
        "You are not assigned to this group",
        403
      );
    }

    return requestedGroupId;
  }

  return staffGroupIds === null
    ? undefined
    : {
        $in: staffGroupIds,
      };
};

const getPostReactionData = async (
  posts,
  userId
) => {
  if (!posts.length) {
    return new Map();
  }

  const postIds = posts.map(
    (post) => post._id
  );

  const reactions =
    await PostReaction.find({
      post: {
        $in: postIds,
      },
    }).select(
      "post user reactionType"
    );

  const reactionMap = new Map();

  for (const post of posts) {
    reactionMap.set(
      post._id.toString(),
      {
        myReaction: null,
        reactionCounts: {
          like: 0,
          love: 0,
          haha: 0,
          wow: 0,
          sad: 0,
          angry: 0,
        },
      }
    );
  }

  for (const reaction of reactions) {
    const postId =
      reaction.post.toString();

    const data =
      reactionMap.get(postId);

    if (!data) {
      continue;
    }

    if (
      data.reactionCounts[
        reaction.reactionType
      ] !== undefined
    ) {
      data.reactionCounts[
        reaction.reactionType
      ] += 1;
    }

    if (
      reaction.user.toString() ===
      userId.toString()
    ) {
      data.myReaction =
        reaction.reactionType;
    }
  }

  return reactionMap;
};

/*
 * Posts created before languages were stored have none saved; work it
 * out from the alphabet instead.
 */
const getPostLanguage = (post) =>
  post.language ?? detectLanguageByScript(post.content);

const buildPostResponse = (
  post,
  viewerUser,
  group,
  likedPostIdSet,
  reactionMap = new Map()
) => {
  const reactionData =
    reactionMap.get(
      post._id.toString()
    ) ?? {
      myReaction: null,
      reactionCounts: {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0,
      },
    };

  return {
    ...post.toSafeObject(),
    author: redactPostAuthor(
      post,
      viewerUser,
      group
    ),
    likedByMe:
      likedPostIdSet.has(
        post._id.toString()
      ),
    myReaction:
      reactionData.myReaction,
    reactionCounts:
      reactionData.reactionCounts,
    language: getPostLanguage(post),
    crisisFlag:
      buildCrisisFlagForViewer(
        post,
        viewerUser,
        group
      ),
  };
};

const buildPostsWithGroupNames = async (
  posts,
  viewerUser
) => {
  if (posts.length === 0) {
    return [];
  }

  const [
    groups,
    likes,
    reactionMap,
  ] = await Promise.all([
    SupportGroup.find({
      _id: {
        $in: [
          ...new Set(
            posts.map(
              (post) =>
                post.group.toString()
            )
          ),
        ],
      },
    }),

    PostLike.find({
      post: {
        $in: posts.map(
          (post) => post._id
        ),
      },
      user: viewerUser._id,
    }),

    getPostReactionData(
      posts,
      viewerUser._id
    ),
  ]);

  const groupMap = new Map(
    groups.map((group) => [
      group._id.toString(),
      group,
    ])
  );

  const likedPostIdSet =
    new Set(
      likes.map((like) =>
        like.post.toString()
      )
    );

  return posts
    .filter((post) =>
      groupMap.has(
        post.group.toString()
      )
    )
    .map((post) => {
      const group =
        groupMap.get(
          post.group.toString()
        );

      return {
        ...buildPostResponse(
          post,
          viewerUser,
          group,
          likedPostIdSet,
          reactionMap
        ),
        groupName: group.name,
      };
    });
};

/*
|--------------------------------------------------------------------------
| CREATE POST
|--------------------------------------------------------------------------
*/

export const createPost = asyncHandler(
  async (req, res) => {
    const group =
      await getActiveGroupOrThrow(
        req.params.groupId
      );

    await assertCanPostOrThrow(
      group,
      req.user
    );

    const content =
      req.body.content.trim();

    const crisisCheck =
      detectCrisisContent(content);

    const contentWarnings = new Set(
      req.body.contentWarnings ?? []
    );

    if (crisisCheck.isCrisis) {
      contentWarnings.add(
        CONTENT_WARNING.SUICIDE_SELF_HARM
      );
    }

    let uploadedImage = null;

    if (req.file) {
      try {
        uploadedImage =
          await uploadPostImageToCloudinary(
            req.file.buffer
          );
      } catch (error) {
        console.error(
          "[post images] Upload failed:",
          error?.message ?? error
        );

        throw new AppError(
          "The image could not be uploaded. Please try again.",
          502
        );
      }
    }

    let post;

    try {
      post = await Post.create({
        group: group._id,
        author: req.user._id,
        content,
        isAnonymous: Boolean(
          req.body.isAnonymous
        ),
        contentWarnings: [
          ...contentWarnings,
        ],
        language:
          detectLanguageByScript(content),
        imageUrl:
          uploadedImage?.secureUrl ?? null,
        imagePublicId:
          uploadedImage?.publicId ?? null,
        crisisFlag:
          crisisCheck.isCrisis
            ? {
                isFlagged: true,
                matchedTerms:
                  crisisCheck.matchedTerms,
                flaggedAt: new Date(),
                source:
                  CRISIS_FLAG_SOURCE.KEYWORD,
              }
            : undefined,
        aiSafety: {
          status: isAiSafetyEnabled()
            ? AI_SAFETY_STATUS.PENDING
            : AI_SAFETY_STATUS.SKIPPED,
        },
      });
    } catch (error) {
      await deletePostImageFromCloudinary(
        uploadedImage?.publicId
      );

      throw error;
    }

    /*
     * AI safety check. Only the post text is sent. It never fails the
     * request: on any problem the keyword result above still stands.
     * We wait briefly so the author can be shown support resources
     * right away; a slower check finishes in the background.
     */
    const aiOutcome = await waitUpTo(
      reviewPostWithAi(post),
      AI_SAFETY_INLINE_WAIT_MS
    );

    const populatedPost =
      await populatePostAuthor(
        Post.findById(post._id)
      );

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: {
        post: buildPostResponse(
          populatedPost,
          req.user,
          group,
          new Set(),
          new Map()
        ),
        safety: {
          crisisDetected:
            crisisCheck.isCrisis ||
            Boolean(aiOutcome?.isCrisis),
        },
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET POST BY ID
|--------------------------------------------------------------------------
*/

export const getPostById = asyncHandler(
  async (req, res) => {
    const {
      post,
      group,
    } = await getPostWithGroupOrThrow(
      req.params.postId,
      {
        allowRemoved: true,
      }
    );

    await assertCanAccessGroupContentOrThrow(
      group,
      req.user
    );

    const isStaff =
      isGroupStaffOrAdmin(
        req.user,
        group
      );

    if (post.isRemoved && !isStaff) {
      throw new AppError(
        "Post was not found",
        404
      );
    }

    const existingLike =
      await PostLike.findOne({
        post: post._id,
        user: req.user._id,
      });

    const likedPostIdSet =
      new Set(
        existingLike
          ? [post._id.toString()]
          : []
      );

    const reactionMap =
      await getPostReactionData(
        [post],
        req.user._id
      );

    return res.status(200).json({
      success: true,
      message: "Post retrieved successfully",
      data: {
        post: {
          ...buildPostResponse(
            post,
            req.user,
            group,
            likedPostIdSet,
            reactionMap
          ),
          ...(post.isRemoved
            ? {
                removedAt:
                  post.removedAt,
                removalReason:
                  post.removalReason,
              }
            : {}),
        },
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| TRANSLATE POST
|--------------------------------------------------------------------------
|
| Translates a post into English, Sinhala or Tamil with Gemini. The
| result is saved on the post, so each language costs one AI call and
| every later reader gets it instantly.
|
*/

/*
 * New translations one user may request per hour. Saved translations
 * do not count — they cost nothing.
 */
const TRANSLATION_LIMIT_PER_HOUR = 30;
const TRANSLATION_WINDOW_MS = 60 * 60 * 1000;

const recentTranslationRequests = new Map();

const assertTranslationAllowanceOrThrow = (userId) => {
  const key = userId.toString();
  const now = Date.now();

  const recent = (
    recentTranslationRequests.get(key) ?? []
  ).filter((time) => now - time < TRANSLATION_WINDOW_MS);

  if (recent.length >= TRANSLATION_LIMIT_PER_HOUR) {
    recentTranslationRequests.set(key, recent);

    throw new AppError(
      "You have translated a lot of posts in the last hour. Please try again later.",
      429
    );
  }

  recent.push(now);
  recentTranslationRequests.set(key, recent);
};

const TRANSLATION_UNAVAILABLE_MESSAGES = Object.freeze({
  not_configured:
    "Translation is not available on this server.",
  rate_limited:
    "Translation is busy right now. Please try again in a minute.",
  paused_after_upstream_error:
    "Translation is busy right now. Please try again in a minute.",
  timeout:
    "Translation took too long. Please try again.",
});

/*
 * A post already written in the requested language has nothing to
 * translate. Sinhala typed in English letters (SI_LATN) still can be
 * turned into Sinhala script.
 */
const isAlreadyInLanguage = (postLanguage, targetLanguage) =>
  postLanguage === targetLanguage &&
  postLanguage !== POST_LANGUAGE.SI_LATN;

export const translatePost = asyncHandler(
  async (req, res) => {
    const { post, group } =
      await getPostWithGroupOrThrow(
        req.params.postId
      );

    await assertCanAccessGroupContentOrThrow(
      group,
      req.user
    );

    const targetLanguage = req.body.language;
    const sourceLanguage = getPostLanguage(post);

    if (
      isAlreadyInLanguage(
        sourceLanguage,
        targetLanguage
      )
    ) {
      throw new AppError(
        "This post is already in that language",
        400
      );
    }

    if (
      !findSavedTranslation(post, targetLanguage)
    ) {
      assertTranslationAllowanceOrThrow(
        req.user._id
      );
    }

    const result =
      await getOrCreatePostTranslation(
        post,
        targetLanguage
      );

    if (result.status !== "DONE") {
      throw new AppError(
        TRANSLATION_UNAVAILABLE_MESSAGES[
          result.error
        ] ??
          "This post could not be translated right now. Please try again later.",
        503
      );
    }

    return res.status(200).json({
      success: true,
      message: "Post translated successfully",
      data: {
        translation: {
          language: targetLanguage,
          content: result.content,
          isCached: result.isCached,
        },
        sourceLanguage,
        supportedLanguages: Object.values(
          TRANSLATION_LANGUAGE
        ),
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| CRISIS ALERTS (group staff)
|--------------------------------------------------------------------------
*/

export const getCrisisAlerts =
  asyncHandler(
    async (req, res) => {
      const status =
        req.query.status || "open";
      const page =
        Number(req.query.page) || 1;
      const limit =
        Number(req.query.limit) || 20;
      const skip =
        (page - 1) * limit;

      const staffGroupIds =
        await getStaffGroupIds(
          req.user
        );

      const filter = {
        "crisisFlag.isFlagged": true,
        ...NOT_REMOVED,
      };

      if (status === "open") {
        filter[
          "crisisFlag.handledAt"
        ] = null;
      } else if (
        status === "handled"
      ) {
        filter[
          "crisisFlag.handledAt"
        ] = {
          $ne: null,
        };
      }

      const groupFilter =
        buildStaffGroupFilter(
          staffGroupIds,
          req.query.groupId
        );

      if (groupFilter) {
        filter.group = groupFilter;
      }

      const [
        posts,
        totalPosts,
      ] = await Promise.all([
        populatePostAuthor(
          Post.find(filter)
            .sort({
              "aiSafety.riskScore": -1,
              "crisisFlag.flaggedAt":
                -1,
            })
            .skip(skip)
            .limit(limit)
        ),

        Post.countDocuments(
          filter
        ),
      ]);

      const totalPages =
        Math.max(
          1,
          Math.ceil(
            totalPosts / limit
          )
        );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Crisis alerts retrieved successfully",
          data: {
            posts:
              await buildPostsWithGroupNames(
                posts,
                req.user
              ),
            pagination: {
              page,
              limit,
              totalPosts,
              totalPages,
              hasNextPage:
                page < totalPages,
              hasPreviousPage:
                page > 1,
            },
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| NEEDS A RESPONSE QUEUE (group staff)
|--------------------------------------------------------------------------
*/

const NEEDS_RESPONSE_MAX_AGE_DAYS =
  14;

const CRISIS_QUEUE_LIMIT = 50;

export const getNeedsResponseQueue =
  asyncHandler(
    async (req, res) => {
      const page =
        Number(req.query.page) || 1;
      const limit =
        Number(req.query.limit) || 20;
      const skip =
        (page - 1) * limit;

      const staffGroupIds =
        await getStaffGroupIds(
          req.user
        );

      const groupFilter =
        buildStaffGroupFilter(
          staffGroupIds,
          req.query.groupId
        );

      const baseFilter = {
        ...NOT_REMOVED,
        author: {
          $ne: req.user._id,
        },
        ...(groupFilter
          ? {
              group: groupFilter,
            }
          : {}),
      };

      const crisisFilter = {
        ...baseFilter,
        "crisisFlag.isFlagged":
          true,
        "crisisFlag.handledAt":
          null,
      };

      const oldestDate =
        new Date(
          Date.now() -
            NEEDS_RESPONSE_MAX_AGE_DAYS *
              24 *
              60 *
              60 *
              1000
        );

      const unansweredFilter = {
        ...baseFilter,
        commentCount: 0,
        createdAt: {
          $gte: oldestDate,
        },
        $nor: [
          {
            "crisisFlag.isFlagged":
              true,
            "crisisFlag.handledAt":
              null,
          },
        ],
      };

      const [
        crisisPosts,
        totalCrisisAlerts,
        unansweredPosts,
        totalUnanswered,
      ] = await Promise.all([
        populatePostAuthor(
          Post.find(crisisFilter)
            .sort({
              "aiSafety.riskScore": -1,
              "crisisFlag.flaggedAt":
                -1,
            })
            .limit(
              CRISIS_QUEUE_LIMIT
            )
        ),

        Post.countDocuments(
          crisisFilter
        ),

        populatePostAuthor(
          Post.find(
            unansweredFilter
          )
            .sort({
              createdAt: 1,
            })
            .skip(skip)
            .limit(limit)
        ),

        Post.countDocuments(
          unansweredFilter
        ),
      ]);

      const [
        crisisAlerts,
        unanswered,
      ] = await Promise.all([
        buildPostsWithGroupNames(
          crisisPosts,
          req.user
        ),

        buildPostsWithGroupNames(
          unansweredPosts,
          req.user
        ),
      ]);

      const totalPages =
        Math.max(
          1,
          Math.ceil(
            totalUnanswered /
              limit
          )
        );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Needs-response queue retrieved successfully",
          data: {
            crisisAlerts,
            unanswered,
            counts: {
              crisisAlerts:
                totalCrisisAlerts,
              unanswered:
                totalUnanswered,
            },
            maxAgeDays:
              NEEDS_RESPONSE_MAX_AGE_DAYS,
            pagination: {
              page,
              limit,
              totalPosts:
                totalUnanswered,
              totalPages,
              hasNextPage:
                page < totalPages,
              hasPreviousPage:
                page > 1,
            },
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| MARK CRISIS ALERT AS HANDLED
|--------------------------------------------------------------------------
*/

export const markCrisisAlertHandled =
  asyncHandler(
    async (req, res) => {
      const {
        post,
        group,
      } =
        await getPostWithGroupOrThrow(
          req.params.postId
        );

      if (
        !isGroupStaffOrAdmin(
          req.user,
          group
        )
      ) {
        throw new AppError(
          "You do not have permission to handle this crisis alert",
          403
        );
      }

      if (
        !post.crisisFlag?.isFlagged
      ) {
        throw new AppError(
          "This post does not have a crisis alert",
          400
        );
      }

      if (
        !post.crisisFlag.handledAt
      ) {
        post.crisisFlag.handledBy =
          req.user._id;
        post.crisisFlag.handledAt =
          new Date();

        await post.save();
      }

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Crisis alert marked as handled",
          data: {
            crisisFlag:
              formatCrisisFlag(post),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| MY FEED
|--------------------------------------------------------------------------
*/

export const getMyFeed =
  asyncHandler(
    async (req, res) => {
      const memberships =
        await GroupMembership.find({
          user: req.user._id,
          status:
            GROUP_MEMBERSHIP_STATUS.ACTIVE,
        }).select("group");

      const groupIds =
        memberships.map(
          (membership) =>
            membership.group
        );

      const page =
        Number(req.query.page) || 1;
      const limit =
        Number(req.query.limit) || 20;
      const skip =
        (page - 1) * limit;

      const filter = {
        group: {
          $in: groupIds,
        },
        ...NOT_REMOVED,
      };

      const [
        posts,
        totalPosts,
        groups,
      ] = await Promise.all([
        populatePostAuthor(
          Post.find(filter)
            .sort({
              createdAt: -1,
            })
            .skip(skip)
            .limit(limit)
        ),

        Post.countDocuments(
          filter
        ),

        SupportGroup.find({
          _id: {
            $in: groupIds,
          },
        }),
      ]);

      const groupMap = new Map(
        groups.map((group) => [
          group._id.toString(),
          group,
        ])
      );

      const [
        likes,
        reactionMap,
      ] = await Promise.all([
        PostLike.find({
          post: {
            $in: posts.map(
              (post) => post._id
            ),
          },
          user: req.user._id,
        }),

        getPostReactionData(
          posts,
          req.user._id
        ),
      ]);

      const likedPostIdSet =
        new Set(
          likes.map((like) =>
            like.post.toString()
          )
        );

      const totalPages =
        Math.max(
          1,
          Math.ceil(
            totalPosts / limit
          )
        );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Feed retrieved successfully",
          data: {
            posts: posts
              .filter((post) =>
                groupMap.has(
                  post.group.toString()
                )
              )
              .map((post) => {
                const group =
                  groupMap.get(
                    post.group.toString()
                  );

                return {
                  ...buildPostResponse(
                    post,
                    req.user,
                    group,
                    likedPostIdSet,
                    reactionMap
                  ),
                  groupName:
                    group.name,
                };
              }),

            pagination: {
              page,
              limit,
              totalPosts,
              totalPages,
              hasNextPage:
                page < totalPages,
              hasPreviousPage:
                page > 1,
            },
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| LIST GROUP POSTS
|--------------------------------------------------------------------------
*/

export const getGroupPosts =
  asyncHandler(
    async (req, res) => {
      const group =
        await getActiveGroupOrThrow(
          req.params.groupId
        );

      await assertCanAccessGroupContentOrThrow(
        group,
        req.user
      );

      const page =
        Number(req.query.page) || 1;
      const limit =
        Number(req.query.limit) || 20;
      const skip =
        (page - 1) * limit;

      const searchText =
        req.query.q?.trim() ?? "";
      const isSearching =
        searchText.length > 0;

      const filter = {
        group: group._id,
        ...NOT_REMOVED,
      };

      if (isSearching) {
        filter.content = {
          $regex:
            escapeRegex(searchText),
          $options: "i",
        };
      }

      const sortOption =
        req.query.sort ||
        POST_SORT.NEWEST;

      if (
        sortOption ===
        POST_SORT.UNANSWERED
      ) {
        filter.commentCount = 0;
      }

      const sort =
        buildPostSort(
          sortOption,
          isSearching
        );

      const [
        posts,
        totalPosts,
      ] = await Promise.all([
        populatePostAuthor(
          Post.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
        ),

        Post.countDocuments(
          filter
        ),
      ]);

      const [
        likes,
        reactionMap,
      ] = await Promise.all([
        PostLike.find({
          post: {
            $in: posts.map(
              (post) => post._id
            ),
          },
          user: req.user._id,
        }),

        getPostReactionData(
          posts,
          req.user._id
        ),
      ]);

      const likedPostIdSet =
        new Set(
          likes.map((like) =>
            like.post.toString()
          )
        );

      const totalPages =
        Math.max(
          1,
          Math.ceil(
            totalPosts / limit
          )
        );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Posts retrieved successfully",
          data: {
            posts: posts.map(
              (post) =>
                buildPostResponse(
                  post,
                  req.user,
                  group,
                  likedPostIdSet,
                  reactionMap
                )
            ),
            pagination: {
              page,
              limit,
              totalPosts,
              totalPages,
              hasNextPage:
                page < totalPages,
              hasPreviousPage:
                page > 1,
            },
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| DELETE POST
|--------------------------------------------------------------------------
*/

export const deletePost =
  asyncHandler(
    async (req, res) => {
      const {
        post,
        group,
      } =
        await getPostWithGroupOrThrow(
          req.params.postId,
          {
            allowRemoved: true,
          }
        );

      assertCanDeleteOrThrow(
        post.author._id,
        group,
        req.user
      );

      await Promise.all([
        Post.deleteOne({
          _id: post._id,
        }),

        PostComment.deleteMany({
          post: post._id,
        }),

        PostLike.deleteMany({
          post: post._id,
        }),

        PostReaction.deleteMany({
          post: post._id,
        }),

        CommentReaction.deleteMany({
          comment: {
            $in: await PostComment.find({
              post: post._id,
            }).distinct("_id"),
          },
        }),

        deleteNotificationsForPost(
          post._id
        ),

        deletePostImageFromCloudinary(
          post.imagePublicId
        ),
      ]);

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Post deleted successfully",
          data: null,
        });
    }
  );

/*
|--------------------------------------------------------------------------
| TOGGLE PIN / UNPIN
|--------------------------------------------------------------------------
*/

export const togglePostPin =
  asyncHandler(
    async (req, res) => {
      const {
        post,
        group,
      } =
        await getPostWithGroupOrThrow(
          req.params.postId
        );

      if (
        !isGroupStaffOrAdmin(
          req.user,
          group
        )
      ) {
        throw new AppError(
          "You do not have permission to pin this post",
          403
        );
      }

      const updatedPost =
        await Post.findByIdAndUpdate(
          post._id,
          {
            isPinned:
              !post.isPinned,
          },
          {
            new: true,
          }
        );

      return res
        .status(200)
        .json({
          success: true,
          message:
            updatedPost.isPinned
              ? "Post pinned successfully"
              : "Post unpinned successfully",
          data: {
            isPinned:
              updatedPost.isPinned,
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| TOGGLE LIKE
|--------------------------------------------------------------------------
*/

export const togglePostLike =
  asyncHandler(
    async (req, res) => {
      const {
        post,
        group,
      } =
        await getPostWithGroupOrThrow(
          req.params.postId
        );

      await assertCanPostOrThrow(
        group,
        req.user
      );

      const existingLike =
        await PostLike.findOne({
          post: post._id,
          user: req.user._id,
        });

      let liked;

      if (existingLike) {
        await PostLike.deleteOne({
          _id: existingLike._id,
        });

        await Post.findByIdAndUpdate(
          post._id,
          {
            $inc: {
              likeCount: -1,
            },
          }
        );

        liked = false;

        void removePostLikeNotification({
          post,
          actorId: req.user._id,
        });
      } else {
        try {
          await PostLike.create({
            post: post._id,
            user: req.user._id,
          });

          await Post.findByIdAndUpdate(
            post._id,
            {
              $inc: {
                likeCount: 1,
              },
            }
          );

          liked = true;

          void notifyPostLike({
            post,
            actorId: req.user._id,
          });
        } catch (error) {
          if (error?.code === 11000) {
            liked = true;
          } else {
            throw error;
          }
        }
      }

      const updatedPost =
        await Post.findById(
          post._id
        );

      return res
        .status(200)
        .json({
          success: true,
          message: liked
            ? "Post liked successfully"
            : "Post unliked successfully",
          data: {
            liked,
            likeCount:
              updatedPost.likeCount,
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| TOGGLE POST REACTION
|--------------------------------------------------------------------------
*/

export const togglePostReaction =
  asyncHandler(
    async (req, res) => {
      const {
        post,
        group,
      } =
        await getPostWithGroupOrThrow(
          req.params.postId
        );

      await assertCanPostOrThrow(
        group,
        req.user
      );

      const reactionType =
        req.body.reactionType;

      if (
        !POST_REACTION_TYPES.includes(
          reactionType
        )
      ) {
        throw new AppError(
          "Invalid reaction type",
          400
        );
      }

      const existingReaction =
        await PostReaction.findOne({
          post: post._id,
          user: req.user._id,
        });

      if (
        existingReaction &&
        existingReaction.reactionType ===
          reactionType
      ) {
        await PostReaction.deleteOne({
          _id: existingReaction._id,
        });

        const reactionData =
          await getPostReactionData(
            [post],
            req.user._id
          );

        return res
          .status(200)
          .json({
            success: true,
            message:
              "Reaction removed successfully",
            data: {
              reaction: null,
              ...reactionData.get(
                post._id.toString()
              ),
            },
          });
      }

      if (existingReaction) {
        existingReaction.reactionType =
          reactionType;

        await existingReaction.save();
      } else {
        try {
          await PostReaction.create({
            post: post._id,
            user: req.user._id,
            reactionType,
          });
        } catch (error) {
          if (
            error?.code === 11000
          ) {
            const reaction =
              await PostReaction.findOne({
                post: post._id,
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
        await getPostReactionData(
          [post],
          req.user._id
        );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Reaction updated successfully",
          data: {
            reaction: reactionType,
            ...reactionData.get(
              post._id.toString()
            ),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| COMMENT REACTION HELPERS
|--------------------------------------------------------------------------
*/

const getCommentReactionData = async (
  comments,
  userId
) => {
  if (!comments.length) {
    return new Map();
  }

  const commentIds =
    comments.map(
      (comment) => comment._id
    );

  const reactions =
    await CommentReaction.find({
      comment: {
        $in: commentIds,
      },
    }).select(
      "comment user reactionType"
    );

  const reactionMap = new Map();

  for (const comment of comments) {
    reactionMap.set(
      comment._id.toString(),
      {
        myReaction: null,
        reactionCounts: {
          like: 0,
          love: 0,
          haha: 0,
          wow: 0,
          sad: 0,
          angry: 0,
        },
      }
    );
  }

  for (const reaction of reactions) {
    const commentId =
      reaction.comment.toString();

    const data =
      reactionMap.get(commentId);

    if (!data) {
      continue;
    }

    if (
      data.reactionCounts[
        reaction.reactionType
      ] !== undefined
    ) {
      data.reactionCounts[
        reaction.reactionType
      ] += 1;
    }

    if (
      reaction.user.toString() ===
      userId.toString()
    ) {
      data.myReaction =
        reaction.reactionType;
    }
  }

  return reactionMap;
};

/*
|--------------------------------------------------------------------------
| LIST COMMENTS
|--------------------------------------------------------------------------
*/

export const getPostComments =
  asyncHandler(
    async (req, res) => {
      const {
        post,
        group,
      } =
        await getPostWithGroupOrThrow(
          req.params.postId
        );

      await assertCanAccessGroupContentOrThrow(
        group,
        req.user
      );

      const comments =
        await populateCommentAuthor(
          PostComment.find({
            post: post._id,
            ...NOT_REMOVED,
          }).sort({
            createdAt: 1,
          })
        );

      const reactionMap =
        await getCommentReactionData(
          comments,
          req.user._id
        );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Comments retrieved successfully",
          data: {
            comments:
              comments.map(
                (comment) => {
                  const reactionData =
                    reactionMap.get(
                      comment._id.toString()
                    ) ?? {
                      myReaction:
                        null,
                      reactionCounts: {
                        like: 0,
                        love: 0,
                        haha: 0,
                        wow: 0,
                        sad: 0,
                        angry: 0,
                      },
                    };

                  return {
                    ...comment.toSafeObject(),
                    author:
                      formatAuthorSummary(
                        comment.author
                      ),
                    myReaction:
                      reactionData.myReaction,
                    reactionCounts:
                      reactionData.reactionCounts,
                  };
                }
              ),
            totalComments:
              comments.length,
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| CREATE COMMENT
|--------------------------------------------------------------------------
*/

export const createComment =
  asyncHandler(
    async (req, res) => {
      const {
        post,
        group,
      } =
        await getPostWithGroupOrThrow(
          req.params.postId
        );

      await assertCanPostOrThrow(
        group,
        req.user
      );

      const comment =
        await PostComment.create({
          post: post._id,
          group: group._id,
          author: req.user._id,
          content:
            req.body.content.trim(),
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

      return res
        .status(201)
        .json({
          success: true,
          message:
            "Comment added successfully",
          data: {
            comment: {
              ...populatedComment.toSafeObject(),
              author:
                formatAuthorSummary(
                  populatedComment.author
                ),
            },
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| DELETE COMMENT
|--------------------------------------------------------------------------
*/

export const deleteComment =
  asyncHandler(
    async (req, res) => {
      const {
        comment,
        group,
      } =
        await getCommentWithGroupOrThrow(
          req.params.commentId
        );

      assertCanDeleteOrThrow(
        comment.author,
        group,
        req.user
      );

      await PostComment.deleteOne({
        _id: comment._id,
      });

      await CommentReaction.deleteMany({
        comment: comment._id,
      });

      await Post.findByIdAndUpdate(
        comment.post,
        {
          $inc: {
            commentCount: -1,
          },
        }
      );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Comment deleted successfully",
          data: null,
        });
    }
  );