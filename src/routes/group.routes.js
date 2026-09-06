import express from "express";

import {
  assignModerator,
  assignPeerSupporter,
  createGroup,
  getGroupById,
  getGroups,
  getMyAssignedGroups,
  removeModerator,
  removePeerSupporter,
  updateGroup,
} from "../controllers/group.controller.js";

import {
  USER_ROLES,
} from "../constants/auth.constants.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  createGroupValidator,
  groupAssignmentValidator,
  groupIdValidator,
  listGroupsValidator,
  updateGroupValidator,
} from "../validators/group.validator.js";

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| ALL GROUP ROUTES REQUIRE LOGIN
|--------------------------------------------------------------------------
*/

router.use(authenticate);

/*
|--------------------------------------------------------------------------
| BROWSE GROUPS
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  listGroupsValidator,
  validateRequest,
  getGroups
);

/*
|--------------------------------------------------------------------------
| MY ASSIGNED GROUPS
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This route MUST stay before "/:groupId".
|
| Otherwise Express may treat "my-assigned"
| as a groupId.
|
*/

router.get(
  "/my-assigned",
  authorizeRoles(
    USER_ROLES.PEER_SUPPORTER,
    USER_ROLES.MODERATOR
  ),
  getMyAssignedGroups
);

/*
|--------------------------------------------------------------------------
| ADMIN - CREATE GROUP
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  authorizeRoles(
    USER_ROLES.ADMIN
  ),
  createGroupValidator,
  validateRequest,
  createGroup
);

/*
|--------------------------------------------------------------------------
| PEER SUPPORTER ASSIGNMENT
|--------------------------------------------------------------------------
*/

router.post(
  "/:groupId/peer-supporters/:userId",
  authorizeRoles(
    USER_ROLES.ADMIN
  ),
  groupAssignmentValidator,
  validateRequest,
  assignPeerSupporter
);

router.delete(
  "/:groupId/peer-supporters/:userId",
  authorizeRoles(
    USER_ROLES.ADMIN
  ),
  groupAssignmentValidator,
  validateRequest,
  removePeerSupporter
);

/*
|--------------------------------------------------------------------------
| MODERATOR ASSIGNMENT
|--------------------------------------------------------------------------
*/

router.post(
  "/:groupId/moderators/:userId",
  authorizeRoles(
    USER_ROLES.ADMIN
  ),
  groupAssignmentValidator,
  validateRequest,
  assignModerator
);

router.delete(
  "/:groupId/moderators/:userId",
  authorizeRoles(
    USER_ROLES.ADMIN
  ),
  groupAssignmentValidator,
  validateRequest,
  removeModerator
);

/*
|--------------------------------------------------------------------------
| GROUP DETAILS
|--------------------------------------------------------------------------
*/

router.get(
  "/:groupId",
  groupIdValidator,
  validateRequest,
  getGroupById
);

/*
|--------------------------------------------------------------------------
| ADMIN - UPDATE GROUP
|--------------------------------------------------------------------------
*/

router.patch(
  "/:groupId",
  authorizeRoles(
    USER_ROLES.ADMIN
  ),
  updateGroupValidator,
  validateRequest,
  updateGroup
);

export default router;