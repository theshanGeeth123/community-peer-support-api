import express from "express";

import {
  approveJoinRequest,
  getGroupJoinRequests,
  getMyJoinRequests,
  getMyJoinedGroups,
  rejectJoinRequest,
  requestToJoinGroup,
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
  reviewJoinRequestValidator,
} from "../validators/groupMembership.validator.js";

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| ALL ROUTES REQUIRE LOGIN
|--------------------------------------------------------------------------
*/

router.use(
  authenticate
);

/*
|--------------------------------------------------------------------------
| USER ROUTES
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
| PEER SUPPORTER ROUTES
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

export default router;