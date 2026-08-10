import GroupJoinRequest from "../models/GroupJoinRequest.js";
import GroupMembership from "../models/GroupMembership.js";
import SupportGroup from "../models/SupportGroup.js";

import {
  GROUP_MEMBERSHIP_STATUS,
  GROUP_STATUS,
  JOIN_REQUEST_STATUS,
} from "../constants/group.constants.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const normalizeOptionalText = (
  value
) => {
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

const populateJoinRequest = (
  query
) => {
  return query
    .populate({
      path: "group",
      select:
        "name description category communityLocation status",
    })
    .populate({
      path: "user",
      select:
        "fullName email role avatarUrl accountStatus",
    })
    .populate({
      path: "reviewedBy",
      select:
        "fullName email role avatarUrl",
    });
};

const populateMembership = (
  query
) => {
  return query
    .populate({
      path: "group",
      select:
        "name description category communityLocation status moderators peerSupporters",
    })
    .populate({
      path: "user",
      select:
        "fullName email role avatarUrl accountStatus",
    })
    .populate({
      path: "lastUpdatedBy",
      select:
        "fullName email role avatarUrl",
    });
};

const getActiveGroupOrThrow =
  async (
    groupId
  ) => {
    const group =
      await SupportGroup.findOne(
        {
          _id: groupId,
          status:
            GROUP_STATUS.ACTIVE,
        }
      );

    if (!group) {
      throw new AppError(
        "Active support group was not found",
        404
      );
    }

    return group;
  };

const getAssignedGroupForPeerSupporterOrThrow =
  async (
    groupId,
    peerSupporterId
  ) => {
    const group =
      await SupportGroup.findOne(
        {
          _id: groupId,

          status:
            GROUP_STATUS.ACTIVE,

          peerSupporters:
            peerSupporterId,
        }
      );

    if (!group) {
      throw new AppError(
        "You are not assigned as a Peer Supporter for this group",
        403
      );
    }

    return group;
  };

const getAssignedGroupForModeratorOrThrow =
  async (
    groupId,
    moderatorId
  ) => {
    const group =
      await SupportGroup.findOne(
        {
          _id: groupId,

          status:
            GROUP_STATUS.ACTIVE,

          moderators:
            moderatorId,
        }
      );

    if (!group) {
      throw new AppError(
        "You are not assigned as a Moderator for this group",
        403
      );
    }

    return group;
  };

const getPendingRequestOrThrow =
  async (
    requestId
  ) => {
    const joinRequest =
      await GroupJoinRequest.findById(
        requestId
      );

    if (!joinRequest) {
      throw new AppError(
        "Group join request was not found",
        404
      );
    }

    if (
      joinRequest.status !==
      JOIN_REQUEST_STATUS.PENDING
    ) {
      throw new AppError(
        "This group join request has already been reviewed",
        409
      );
    }

    return joinRequest;
  };

const getMembershipForModeratorOrThrow =
  async (
    membershipId,
    moderatorId
  ) => {
    const membership =
      await GroupMembership.findById(
        membershipId
      );

    if (!membership) {
      throw new AppError(
        "Group membership was not found",
        404
      );
    }

    await getAssignedGroupForModeratorOrThrow(
      membership.group,
      moderatorId
    );

    return membership;
  };

/*
|--------------------------------------------------------------------------
| USER - SEND JOIN REQUEST
|--------------------------------------------------------------------------
*/

export const requestToJoinGroup =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const group =
        await getActiveGroupOrThrow(
          req.params.groupId
        );

      const existingMembership =
        await GroupMembership.findOne(
          {
            group:
              group._id,

            user:
              req.user._id,
          }
        );

      if (
        existingMembership?.status ===
        GROUP_MEMBERSHIP_STATUS.ACTIVE
      ) {
        throw new AppError(
          "You are already an active member of this group",
          409
        );
      }

      if (
        existingMembership?.status ===
        GROUP_MEMBERSHIP_STATUS.SUSPENDED
      ) {
        throw new AppError(
          "Your membership in this group is currently suspended",
          403
        );
      }

      if (
        existingMembership?.status ===
        GROUP_MEMBERSHIP_STATUS.REMOVED
      ) {
        throw new AppError(
          "Your membership in this group was removed. Please contact the group support team for assistance.",
          403
        );
      }

      const existingPendingRequest =
        await GroupJoinRequest.findOne(
          {
            group:
              group._id,

            user:
              req.user._id,

            status:
              JOIN_REQUEST_STATUS.PENDING,
          }
        );

      if (
        existingPendingRequest
      ) {
        throw new AppError(
          "You already have a pending join request for this group",
          409
        );
      }

      try {
        const joinRequest =
          await GroupJoinRequest.create(
            {
              group:
                group._id,

              user:
                req.user._id,

              reason:
                req.body.reason.trim(),
            }
          );

        const populatedRequest =
          await populateJoinRequest(
            GroupJoinRequest.findById(
              joinRequest._id
            )
          );

        return res
          .status(201)
          .json({
            success: true,

            message:
              "Group join request submitted successfully",

            data: {
              joinRequest:
                populatedRequest.toSafeObject(),
            },
          });
      } catch (error) {
        if (
          error?.code ===
          11000
        ) {
          throw new AppError(
            "You already have a pending join request for this group",
            409
          );
        }

        throw error;
      }
    }
  );

/*
|--------------------------------------------------------------------------
| USER - MY JOIN REQUESTS
|--------------------------------------------------------------------------
*/

export const getMyJoinRequests =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const requests =
        await populateJoinRequest(
          GroupJoinRequest.find(
            {
              user:
                req.user._id,
            }
          ).sort({
            createdAt: -1,
          })
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Your group join requests were retrieved successfully",

          data: {
            requests:
              requests.map(
                (
                  request
                ) =>
                  request.toSafeObject()
              ),

            totalRequests:
              requests.length,
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| USER - MY JOINED GROUPS
|--------------------------------------------------------------------------
*/

export const getMyJoinedGroups =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const memberships =
        await GroupMembership.find(
          {
            user:
              req.user._id,

            status:
              GROUP_MEMBERSHIP_STATUS.ACTIVE,
          }
        )
          .populate({
            path: "group",

            match: {
              status:
                GROUP_STATUS.ACTIVE,
            },

            select:
              "name description category communityLocation rules status peerSupporters moderators createdAt updatedAt",

            populate: [
              {
                path:
                  "peerSupporters",

                select:
                  "fullName email role avatarUrl accountStatus",
              },

              {
                path:
                  "moderators",

                select:
                  "fullName email role avatarUrl accountStatus",
              },
            ],
          })
          .sort({
            joinedAt: -1,
          });

      const activeMemberships =
        memberships.filter(
          (
            membership
          ) =>
            membership.group
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Your joined support groups were retrieved successfully",

          data: {
            memberships:
              activeMemberships.map(
                (
                  membership
                ) =>
                  membership.toSafeObject()
              ),

            totalGroups:
              activeMemberships.length,
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| PEER SUPPORTER - GET PENDING REQUESTS
|--------------------------------------------------------------------------
*/

export const getGroupJoinRequests =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const group =
        await getAssignedGroupForPeerSupporterOrThrow(
          req.params.groupId,
          req.user._id
        );

      const requests =
        await populateJoinRequest(
          GroupJoinRequest.find(
            {
              group:
                group._id,

              status:
                JOIN_REQUEST_STATUS.PENDING,
            }
          ).sort({
            createdAt: 1,
          })
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Pending group join requests were retrieved successfully",

          data: {
            group: {
              id:
                group._id.toString(),

              name:
                group.name,
            },

            requests:
              requests.map(
                (
                  request
                ) =>
                  request.toSafeObject()
              ),

            totalRequests:
              requests.length,
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| PEER SUPPORTER - APPROVE
|--------------------------------------------------------------------------
*/

export const approveJoinRequest =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const joinRequest =
        await getPendingRequestOrThrow(
          req.params.requestId
        );

      await getAssignedGroupForPeerSupporterOrThrow(
        joinRequest.group,
        req.user._id
      );

      const existingMembership =
        await GroupMembership.findOne(
          {
            group:
              joinRequest.group,

            user:
              joinRequest.user,
          }
        );

      if (
        existingMembership?.status ===
        GROUP_MEMBERSHIP_STATUS.SUSPENDED
      ) {
        throw new AppError(
          "This user's group membership is suspended and cannot be approved through a join request",
          409
        );
      }

      if (
        existingMembership?.status ===
        GROUP_MEMBERSHIP_STATUS.REMOVED
      ) {
        throw new AppError(
          "This user's group membership was removed and cannot be restored through a join request",
          409
        );
      }

      await GroupMembership.findOneAndUpdate(
        {
          group:
            joinRequest.group,

          user:
            joinRequest.user,
        },

        {
          $set: {
            status:
              GROUP_MEMBERSHIP_STATUS.ACTIVE,

            lastUpdatedBy:
              req.user._id,

            statusReason:
              null,

            suspendedAt:
              null,

            removedAt:
              null,
          },

          $setOnInsert: {
            joinedAt:
              new Date(),
          },
        },

        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert:
            true,
        }
      );

      joinRequest.status =
        JOIN_REQUEST_STATUS.APPROVED;

      joinRequest.reviewedBy =
        req.user._id;

      joinRequest.reviewNote =
        normalizeOptionalText(
          req.body.reviewNote
        );

      joinRequest.reviewedAt =
        new Date();

      await joinRequest.save();

      const populatedRequest =
        await populateJoinRequest(
          GroupJoinRequest.findById(
            joinRequest._id
          )
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Group join request approved successfully",

          data: {
            joinRequest:
              populatedRequest.toSafeObject(),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| PEER SUPPORTER - REJECT
|--------------------------------------------------------------------------
*/

export const rejectJoinRequest =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const joinRequest =
        await getPendingRequestOrThrow(
          req.params.requestId
        );

      await getAssignedGroupForPeerSupporterOrThrow(
        joinRequest.group,
        req.user._id
      );

      joinRequest.status =
        JOIN_REQUEST_STATUS.REJECTED;

      joinRequest.reviewedBy =
        req.user._id;

      joinRequest.reviewNote =
        normalizeOptionalText(
          req.body.reviewNote
        );

      joinRequest.reviewedAt =
        new Date();

      await joinRequest.save();

      const populatedRequest =
        await populateJoinRequest(
          GroupJoinRequest.findById(
            joinRequest._id
          )
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Group join request rejected successfully",

          data: {
            joinRequest:
              populatedRequest.toSafeObject(),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| MODERATOR - GROUP MEMBERS
|--------------------------------------------------------------------------
*/

export const getModeratorGroupMembers =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const group =
        await getAssignedGroupForModeratorOrThrow(
          req.params.groupId,
          req.user._id
        );

      const memberships =
        await populateMembership(
          GroupMembership.find(
            {
              group:
                group._id,
            }
          ).sort({
            joinedAt: -1,
          })
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Group members retrieved successfully",

          data: {
            group: {
              id:
                group._id.toString(),

              name:
                group.name,
            },

            memberships:
              memberships.map(
                (
                  membership
                ) =>
                  membership.toSafeObject()
              ),

            totalMembers:
              memberships.length,
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| MODERATOR - SUSPEND MEMBER
|--------------------------------------------------------------------------
*/

export const suspendGroupMembership =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const membership =
        await getMembershipForModeratorOrThrow(
          req.params.membershipId,
          req.user._id
        );

      if (
        membership.status ===
        GROUP_MEMBERSHIP_STATUS.REMOVED
      ) {
        throw new AppError(
          "Removed memberships cannot be suspended",
          409
        );
      }

      if (
        membership.status ===
        GROUP_MEMBERSHIP_STATUS.SUSPENDED
      ) {
        throw new AppError(
          "This membership is already suspended",
          409
        );
      }

      membership.status =
        GROUP_MEMBERSHIP_STATUS.SUSPENDED;

      membership.suspendedAt =
        new Date();

      membership.removedAt =
        null;

      membership.lastUpdatedBy =
        req.user._id;

      membership.statusReason =
        req.body.reason.trim();

      await membership.save();

      const populatedMembership =
        await populateMembership(
          GroupMembership.findById(
            membership._id
          )
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Group membership suspended successfully",

          data: {
            membership:
              populatedMembership.toSafeObject(),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| MODERATOR - REACTIVATE SUSPENDED MEMBER
|--------------------------------------------------------------------------
*/

export const reactivateGroupMembership =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const membership =
        await getMembershipForModeratorOrThrow(
          req.params.membershipId,
          req.user._id
        );

      if (
        membership.status !==
        GROUP_MEMBERSHIP_STATUS.SUSPENDED
      ) {
        throw new AppError(
          "Only suspended memberships can be reactivated",
          409
        );
      }

      membership.status =
        GROUP_MEMBERSHIP_STATUS.ACTIVE;

      membership.suspendedAt =
        null;

      membership.removedAt =
        null;

      membership.lastUpdatedBy =
        req.user._id;

      membership.statusReason =
        normalizeOptionalText(
          req.body.reason
        );

      await membership.save();

      const populatedMembership =
        await populateMembership(
          GroupMembership.findById(
            membership._id
          )
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Group membership reactivated successfully",

          data: {
            membership:
              populatedMembership.toSafeObject(),
          },
        });
    }
  );

/*
|--------------------------------------------------------------------------
| MODERATOR - REMOVE MEMBER
|--------------------------------------------------------------------------
*/

export const removeGroupMembership =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const membership =
        await getMembershipForModeratorOrThrow(
          req.params.membershipId,
          req.user._id
        );

      if (
        membership.status ===
        GROUP_MEMBERSHIP_STATUS.REMOVED
      ) {
        throw new AppError(
          "This membership has already been removed",
          409
        );
      }

      membership.status =
        GROUP_MEMBERSHIP_STATUS.REMOVED;

      membership.removedAt =
        new Date();

      membership.suspendedAt =
        null;

      membership.lastUpdatedBy =
        req.user._id;

      membership.statusReason =
        req.body.reason.trim();

      await membership.save();

      const populatedMembership =
        await populateMembership(
          GroupMembership.findById(
            membership._id
          )
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Member removed from group successfully",

          data: {
            membership:
              populatedMembership.toSafeObject(),
          },
        });
    }
  );