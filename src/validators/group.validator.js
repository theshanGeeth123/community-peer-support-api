import {
  body,
  param,
  query,
} from "express-validator";

import {
  GROUP_STATUS,
} from "../constants/group.constants.js";

const validateRules = [
  body("rules")
    .optional()
    .isArray({
      max: 20,
    })
    .withMessage(
      "Rules must be an array containing at most 20 items"
    ),

  body("rules.*")
    .optional()
    .isString()
    .withMessage(
      "Each group rule must be text"
    )
    .bail()
    .trim()
    .isLength({
      min: 3,
      max: 300,
    })
    .withMessage(
      "Each group rule must contain between 3 and 300 characters"
    ),
];

export const groupIdValidator = [
  param("groupId")
    .isMongoId()
    .withMessage(
      "Invalid group ID"
    ),
];

export const groupAssignmentValidator = [
  param("groupId")
    .isMongoId()
    .withMessage(
      "Invalid group ID"
    ),

  param("userId")
    .isMongoId()
    .withMessage(
      "Invalid user ID"
    ),
];

export const createGroupValidator = [
  body("name")
    .notEmpty()
    .withMessage(
      "Group name is required"
    )
    .bail()
    .isString()
    .withMessage(
      "Group name must be text"
    )
    .bail()
    .trim()
    .isLength({
      min: 3,
      max: 100,
    })
    .withMessage(
      "Group name must contain between 3 and 100 characters"
    ),

  body("description")
    .notEmpty()
    .withMessage(
      "Group description is required"
    )
    .bail()
    .isString()
    .withMessage(
      "Group description must be text"
    )
    .bail()
    .trim()
    .isLength({
      min: 10,
      max: 1000,
    })
    .withMessage(
      "Group description must contain between 10 and 1000 characters"
    ),

  body("category")
    .notEmpty()
    .withMessage(
      "Group category is required"
    )
    .bail()
    .isString()
    .withMessage(
      "Group category must be text"
    )
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 80,
    })
    .withMessage(
      "Group category must contain between 2 and 80 characters"
    ),

  body("communityLocation")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Community location must be text"
    )
    .bail()
    .trim()
    .isLength({
      max: 120,
    })
    .withMessage(
      "Community location cannot exceed 120 characters"
    ),

  ...validateRules,
];

export const listGroupsValidator = [
  query("page")
    .optional()
    .isInt({
      min: 1,
    })
    .withMessage(
      "Page must be a positive integer"
    )
    .toInt(),

  query("limit")
    .optional()
    .isInt({
      min: 1,
      max: 100,
    })
    .withMessage(
      "Limit must be between 1 and 100"
    )
    .toInt(),

  query("search")
    .optional()
    .trim()
    .isLength({
      max: 100,
    })
    .withMessage(
      "Search value is too long"
    ),

  query("category")
    .optional()
    .trim()
    .isLength({
      min: 2,
      max: 80,
    })
    .withMessage(
      "Category must contain between 2 and 80 characters"
    ),

  query("status")
    .optional()
    .isIn(
      Object.values(
        GROUP_STATUS
      )
    )
    .withMessage(
      "Invalid group status"
    ),
];

export const updateGroupValidator = [
  ...groupIdValidator,

  body().custom(
    (value, { req }) => {
      const editableFields =
        [
          "name",
          "description",
          "category",
          "communityLocation",
          "rules",
          "status",
        ];

      const hasEditableField =
        editableFields.some(
          (field) =>
            Object.prototype.hasOwnProperty.call(
              req.body,
              field
            )
        );

      if (!hasEditableField) {
        throw new Error(
          "At least one editable group field is required"
        );
      }

      return true;
    }
  ),

  body("name")
    .optional()
    .isString()
    .withMessage(
      "Group name must be text"
    )
    .bail()
    .trim()
    .isLength({
      min: 3,
      max: 100,
    })
    .withMessage(
      "Group name must contain between 3 and 100 characters"
    ),

  body("description")
    .optional()
    .isString()
    .withMessage(
      "Group description must be text"
    )
    .bail()
    .trim()
    .isLength({
      min: 10,
      max: 1000,
    })
    .withMessage(
      "Group description must contain between 10 and 1000 characters"
    ),

  body("category")
    .optional()
    .isString()
    .withMessage(
      "Group category must be text"
    )
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 80,
    })
    .withMessage(
      "Group category must contain between 2 and 80 characters"
    ),

  body("communityLocation")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Community location must be text"
    )
    .bail()
    .trim()
    .isLength({
      max: 120,
    })
    .withMessage(
      "Community location cannot exceed 120 characters"
    ),

  body("status")
    .optional()
    .isIn(
      Object.values(
        GROUP_STATUS
      )
    )
    .withMessage(
      "Invalid group status"
    ),

  ...validateRules,
];