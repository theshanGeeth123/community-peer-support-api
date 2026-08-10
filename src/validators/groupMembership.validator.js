import {
  body,
  param,
} from "express-validator";

export const joinGroupValidator = [
  param("groupId")
    .isMongoId()
    .withMessage(
      "Invalid group ID"
    ),

  body("reason")
    .notEmpty()
    .withMessage(
      "Join request reason is required"
    )
    .bail()

    .isString()
    .withMessage(
      "Join request reason must be text"
    )
    .bail()

    .trim()

    .isLength({
      min: 10,
      max: 500,
    })
    .withMessage(
      "Join request reason must contain between 10 and 500 characters"
    ),
];

export const groupJoinRequestListValidator = [
  param("groupId")
    .isMongoId()
    .withMessage(
      "Invalid group ID"
    ),
];

export const reviewJoinRequestValidator = [
  param("requestId")
    .isMongoId()
    .withMessage(
      "Invalid join request ID"
    ),

  body("reviewNote")
    .optional({
      nullable: true,
    })

    .isString()
    .withMessage(
      "Review note must be text"
    )
    .bail()

    .trim()

    .isLength({
      max: 500,
    })
    .withMessage(
      "Review note cannot exceed 500 characters"
    ),
];