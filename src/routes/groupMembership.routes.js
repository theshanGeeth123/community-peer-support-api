import express from "express";

import {
  approveJoinRequest,
  getGroupJoinRequests,
  getModeratorGroupMembers,
  getMyJoinRequests,
  getMyJoinedGroups,
  reactivateGroupMembership,
  rejectJoinRequest,
  removeGroupMembership,
  requestToJoinGroup,
  suspendGroupMembership,
} from "../controllers/groupMembership.controller.js";

import {
  USER_ROLES,
} from "../constants/auth.constants.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  groupJoinRequestListValidator,
  joinGroupValidator,
  moderateMembershipValidator,
  moderatorGroupMembersValidator,
  reactivateMembershipValidator,
  reviewJoinRequestValidator,
} from "../validators/groupMembership.validator.js";

const router =
  express.Router();

router.use(
  authenticate
);

/*
|--------------------------------------------------------------------------
| USER
|--------------------------------------------------------------------------
*/

router.post(
  "/groups/:groupId/join-request",
  authorizeRoles(
    USER_ROLES.USER
  ),
  joinGroupValidator,
  validateRequest,
  requestToJoinGroup
);

router.get(
  "/my-requests",
  authorizeRoles(
    USER_ROLES.USER
  ),
  getMyJoinRequests
);

router.get(
  "/my-groups",
  authorizeRoles(
    USER_ROLES.USER
  ),
  getMyJoinedGroups
);

/*
|--------------------------------------------------------------------------
| PEER SUPPORTER
|--------------------------------------------------------------------------
*/

router.get(
  "/groups/:groupId/join-requests",
  authorizeRoles(
    USER_ROLES.PEER_SUPPORTER
  ),
  groupJoinRequestListValidator,
  validateRequest,
  getGroupJoinRequests
);

router.patch(
  "/join-requests/:requestId/approve",
  authorizeRoles(
    USER_ROLES.PEER_SUPPORTER
  ),
  reviewJoinRequestValidator,
  validateRequest,
  approveJoinRequest
);

router.patch(
  "/join-requests/:requestId/reject",
  authorizeRoles(
    USER_ROLES.PEER_SUPPORTER
  ),
  reviewJoinRequestValidator,
  validateRequest,
  rejectJoinRequest
);

/*
|--------------------------------------------------------------------------
| MODERATOR
|--------------------------------------------------------------------------
*/

router.get(
  "/groups/:groupId/members",
  authorizeRoles(
    USER_ROLES.MODERATOR
  ),
  moderatorGroupMembersValidator,
  validateRequest,
  getModeratorGroupMembers
);

router.patch(
  "/memberships/:membershipId/suspend",
  authorizeRoles(
    USER_ROLES.MODERATOR
  ),
  moderateMembershipValidator,
  validateRequest,
  suspendGroupMembership
);

router.patch(
  "/memberships/:membershipId/reactivate",
  authorizeRoles(
    USER_ROLES.MODERATOR
  ),
  reactivateMembershipValidator,
  validateRequest,
  reactivateGroupMembership
);

router.patch(
  "/memberships/:membershipId/remove",
  authorizeRoles(
    USER_ROLES.MODERATOR
  ),
  moderateMembershipValidator,
  validateRequest,
  removeGroupMembership
);

export default router;