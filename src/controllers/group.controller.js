import SupportGroup from "../models/SupportGroup.js";
import User from "../models/User.js";

import {
  ACCOUNT_STATUS,
  USER_ROLES,
} from "../constants/auth.constants.js";

import {
  GROUP_STATUS,
} from "../constants/group.constants.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const escapeRegex = (value) => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const normalizeOptionalText = (value) => {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const trimmedValue =
    value.trim();

  return trimmedValue || null;
};

const normalizeRules = (rules) => {
  if (!Array.isArray(rules)) {
    return rules;
  }

  return rules.map((rule) =>
    rule.trim()
  );
};

const populateGroup = (query) => {
  return query
    .populate({
      path: "createdBy",
      select:
        "fullName email role avatarUrl accountStatus",
    })
    .populate({
      path: "peerSupporters",
      select:
        "fullName email role avatarUrl accountStatus",
    })
    .populate({
      path: "moderators",
      select:
        "fullName email role avatarUrl accountStatus",
    });
};

const findGroupByName = async (
  name,
  excludedGroupId = null
) => {
  const escapedName =
    escapeRegex(name.trim());

  const filter = {
    name: {
      $regex: `^${escapedName}$`,
      $options: "i",
    },
  };

  if (excludedGroupId) {
    filter._id = {
      $ne: excludedGroupId,
    };
  }

  return SupportGroup.findOne(
    filter
  );
};

const getGroupOrThrow = async (
  groupId
) => {
  const group =
    await SupportGroup.findById(
      groupId
    );

  if (!group) {
    throw new AppError(
      "Support group was not found",
      404
    );
  }

  return group;
};

const getPopulatedGroupOrThrow =
  async (groupId) => {
    const group =
      await populateGroup(
        SupportGroup.findById(
          groupId
        )
      );

    if (!group) {
      throw new AppError(
        "Support group was not found",
        404
      );
    }

    return group;
  };

const getAssignableUserOrThrow =
  async (
    userId,
    expectedRole,
    roleLabel
  ) => {
    const user =
      await User.findById(
        userId
      );

    if (!user) {
      throw new AppError(
        "User account was not found",
        404
      );
    }

    if (
      user.accountStatus !==
      ACCOUNT_STATUS.ACTIVE
    ) {
      throw new AppError(
        `Only active users can be assigned as ${roleLabel}`,
        409
      );
    }

    if (
      user.role !== expectedRole
    ) {
      throw new AppError(
        `Selected user must have the ${roleLabel} role`,
        422
      );
    }

    return user;
  };

/*
|--------------------------------------------------------------------------
| CREATE GROUP
|--------------------------------------------------------------------------
*/

export const createGroup =
  asyncHandler(
    async (req, res) => {
      const {
        name,
        description,
        category,
        communityLocation,
        rules = [],
      } = req.body;

      const existingGroup =
        await findGroupByName(
          name
        );

      if (existingGroup) {
        throw new AppError(
          "A support group already exists with this name",
          409
        );
      }

      try {
        const group =
          await SupportGroup.create(
            {
              name:
                name.trim(),

              description:
                description.trim(),

              category:
                category.trim(),

              communityLocation:
                normalizeOptionalText(
                  communityLocation
                ),

              rules:
                normalizeRules(
                  rules
                ),

              createdBy:
                req.user._id,
            }
          );

        const populatedGroup =
          await getPopulatedGroupOrThrow(
            group._id
          );

        return res
          .status(201)
          .json({
            success: true,

            message:
              "Support group created successfully",

            data: {
              group:
                populatedGroup.toSafeObject(),
            },
          });
      } catch (error) {
        if (
          error?.code ===
          11000
        ) {
          throw new AppError(
            "A support group already exists with this name",
            409
          );
        }

        throw error;
      }
    }
  );

/*
|--------------------------------------------------------------------------
| GET GROUPS
|--------------------------------------------------------------------------
*/

export const getGroups =
  asyncHandler(
    async (req, res) => {
      const page =
        req.query.page || 1;

      const limit =
        req.query.limit || 20;

      const skip =
        (page - 1) * limit;

      const {
        search,
        category,
        status,
      } = req.query;

      const filter = {};

      /*
       * ADMIN can view
       * ACTIVE and INACTIVE.
       *
       * Other roles can only
       * browse ACTIVE groups.
       */
      if (
        req.user.role ===
        USER_ROLES.ADMIN
      ) {
        if (status) {
          filter.status =
            status;
        }
      } else {
        filter.status =
          GROUP_STATUS.ACTIVE;
      }

      if (category) {
        filter.category = {
          $regex:
            `^${escapeRegex(
              category
            )}$`,
          $options: "i",
        };
      }

      if (search) {
        const safeSearch =
          escapeRegex(search);

        filter.$or = [
          {
            name: {
              $regex:
                safeSearch,
              $options: "i",
            },
          },

          {
            description: {
              $regex:
                safeSearch,
              $options: "i",
            },
          },

          {
            category: {
              $regex:
                safeSearch,
              $options: "i",
            },
          },

          {
            communityLocation: {
              $regex:
                safeSearch,
              $options: "i",
            },
          },
        ];
      }

      const [
        groups,
        totalGroups,
      ] =
        await Promise.all([
          SupportGroup.find(
            filter
          )
            .populate({
              path:
                "createdBy",

              select:
                "fullName email role avatarUrl",
            })
            .sort({
              createdAt: -1,
            })
            .skip(skip)
            .limit(limit),

          SupportGroup.countDocuments(
            filter
          ),
        ]);

      const totalPages =
        Math.max(
          1,
          Math.ceil(
            totalGroups /
              limit
          )
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Support groups retrieved successfully",

          data: {
            groups:
              groups.map(
                (group) => ({
                  ...group.toSafeObject(),

                  peerSupporterCount:
                    group
                      .peerSupporters
                      .length,

                  moderatorCount:
                    group
                      .moderators
                      .length,
                })
              ),

            pagination: {
              page,
              limit,
              totalGroups,
              totalPages,

              hasNextPage:
                page <
                totalPages,

              hasPreviousPage:
                page > 1,
            },
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| GET MY ASSIGNED GROUPS
|--------------------------------------------------------------------------
|
| PEER_SUPPORTER:
|   Finds groups where the logged-in user
|   exists inside peerSupporters[].
|
| MODERATOR:
|   Finds groups where the logged-in user
|   exists inside moderators[].
|
*/

export const getMyAssignedGroups =
  asyncHandler(
    async (req, res) => {
      const userId =
        req.user._id;

      const role =
        req.user.role;

      const filter = {
        status:
          GROUP_STATUS.ACTIVE,
      };

      if (
        role ===
        USER_ROLES.PEER_SUPPORTER
      ) {
        filter.peerSupporters =
          userId;
      } else if (
        role ===
        USER_ROLES.MODERATOR
      ) {
        filter.moderators =
          userId;
      } else {
        throw new AppError(
          "This feature is available only for Peer Supporters and Moderators",
          403
        );
      }

      const groups =
        await SupportGroup.find(
          filter
        )
          .populate({
            path:
              "createdBy",

            select:
              "fullName email role avatarUrl",
          })
          .populate({
            path:
              "peerSupporters",

            select:
              "fullName email role avatarUrl accountStatus",
          })
          .populate({
            path:
              "moderators",

            select:
              "fullName email role avatarUrl accountStatus",
          })
          .sort({
            createdAt: -1,
          });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Assigned support groups retrieved successfully",

          data: {
            groups:
              groups.map(
                (group) =>
                  group.toSafeObject()
              ),

            totalGroups:
              groups.length,
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| GET GROUP BY ID
|--------------------------------------------------------------------------
*/

export const getGroupById =
  asyncHandler(
    async (req, res) => {
      const group =
        await getPopulatedGroupOrThrow(
          req.params.groupId
        );

      if (
        req.user.role !==
          USER_ROLES.ADMIN &&
        group.status !==
          GROUP_STATUS.ACTIVE
      ) {
        throw new AppError(
          "Support group was not found",
          404
        );
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Support group retrieved successfully",

          data: {
            group:
              group.toSafeObject(),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| UPDATE GROUP
|--------------------------------------------------------------------------
*/

export const updateGroup =
  asyncHandler(
    async (req, res) => {
      const group =
        await getGroupOrThrow(
          req.params.groupId
        );

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          "name"
        )
      ) {
        const duplicateGroup =
          await findGroupByName(
            req.body.name,
            group._id
          );

        if (duplicateGroup) {
          throw new AppError(
            "A support group already exists with this name",
            409
          );
        }
      }

      const editableFields = [
        "name",
        "description",
        "category",
        "communityLocation",
        "rules",
        "status",
      ];

      for (
        const field of
        editableFields
      ) {
        if (
          !Object.prototype.hasOwnProperty.call(
            req.body,
            field
          )
        ) {
          continue;
        }

        if (
          field ===
          "communityLocation"
        ) {
          group.communityLocation =
            normalizeOptionalText(
              req.body[field]
            );

          continue;
        }

        if (
          field === "rules"
        ) {
          group.rules =
            normalizeRules(
              req.body[field]
            );

          continue;
        }

        group[field] =
          typeof req.body[
            field
          ] === "string"
            ? req.body[
                field
              ].trim()
            : req.body[
                field
              ];
      }

      try {
        await group.save();
      } catch (error) {
        if (
          error?.code ===
          11000
        ) {
          throw new AppError(
            "A support group already exists with this name",
            409
          );
        }

        throw error;
      }

      const populatedGroup =
        await getPopulatedGroupOrThrow(
          group._id
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Support group updated successfully",

          data: {
            group:
              populatedGroup.toSafeObject(),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| ASSIGN PEER SUPPORTER
|--------------------------------------------------------------------------
*/

export const assignPeerSupporter =
  asyncHandler(
    async (req, res) => {
      const group =
        await getGroupOrThrow(
          req.params.groupId
        );

      const user =
        await getAssignableUserOrThrow(
          req.params.userId,
          USER_ROLES.PEER_SUPPORTER,
          "PEER_SUPPORTER"
        );

      const alreadyAssigned =
        group.peerSupporters.some(
          (id) =>
            id.toString() ===
            user._id.toString()
        );

      if (!alreadyAssigned) {
        group.peerSupporters.push(
          user._id
        );

        await group.save();
      }

      const populatedGroup =
        await getPopulatedGroupOrThrow(
          group._id
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            alreadyAssigned
              ? "Peer Supporter is already assigned to this group"
              : "Peer Supporter assigned successfully",

          data: {
            group:
              populatedGroup.toSafeObject(),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| REMOVE PEER SUPPORTER
|--------------------------------------------------------------------------
*/

export const removePeerSupporter =
  asyncHandler(
    async (req, res) => {
      const group =
        await getGroupOrThrow(
          req.params.groupId
        );

      const wasAssigned =
        group.peerSupporters.some(
          (id) =>
            id.toString() ===
            req.params.userId
        );

      group.peerSupporters.pull(
        req.params.userId
      );

      if (wasAssigned) {
        await group.save();
      }

      const populatedGroup =
        await getPopulatedGroupOrThrow(
          group._id
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            wasAssigned
              ? "Peer Supporter removed from group successfully"
              : "Peer Supporter was not assigned to this group",

          data: {
            group:
              populatedGroup.toSafeObject(),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| ASSIGN MODERATOR
|--------------------------------------------------------------------------
*/

export const assignModerator =
  asyncHandler(
    async (req, res) => {
      const group =
        await getGroupOrThrow(
          req.params.groupId
        );

      const user =
        await getAssignableUserOrThrow(
          req.params.userId,
          USER_ROLES.MODERATOR,
          "MODERATOR"
        );

      const alreadyAssigned =
        group.moderators.some(
          (id) =>
            id.toString() ===
            user._id.toString()
        );

      if (!alreadyAssigned) {
        group.moderators.push(
          user._id
        );

        await group.save();
      }

      const populatedGroup =
        await getPopulatedGroupOrThrow(
          group._id
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            alreadyAssigned
              ? "Moderator is already assigned to this group"
              : "Moderator assigned successfully",

          data: {
            group:
              populatedGroup.toSafeObject(),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| REMOVE MODERATOR
|--------------------------------------------------------------------------
*/

export const removeModerator =
  asyncHandler(
    async (req, res) => {
      const group =
        await getGroupOrThrow(
          req.params.groupId
        );

      const wasAssigned =
        group.moderators.some(
          (id) =>
            id.toString() ===
            req.params.userId
        );

      group.moderators.pull(
        req.params.userId
      );

      if (wasAssigned) {
        await group.save();
      }

      const populatedGroup =
        await getPopulatedGroupOrThrow(
          group._id
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            wasAssigned
              ? "Moderator removed from group successfully"
              : "Moderator was not assigned to this group",

          data: {
            group:
              populatedGroup.toSafeObject(),
          },
        });
    }
  );