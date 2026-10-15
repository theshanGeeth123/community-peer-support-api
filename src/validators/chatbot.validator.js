import {
  body,
} from "express-validator";

const ALLOWED_HISTORY_ROLES =
  new Set([
    "user",
    "model",
  ]);

export const sendChatbotMessageValidator =
  [
    body("message")
      .exists({
        checkNull: true,
      })
      .withMessage(
        "Message is required"
      )
      .bail()
      .isString()
      .withMessage(
        "Message must be text"
      )
      .bail()
      .trim()
      .notEmpty()
      .withMessage(
        "Message cannot be empty"
      )
      .bail()
      .isLength({
        max: 1000,
      })
      .withMessage(
        "Message cannot exceed 1000 characters"
      ),

    body("history")
      .optional()
      .isArray()
      .withMessage(
        "History must be an array"
      )
      .bail()
      .custom(
        (history) => {
          if (
            history.length >
            10
          ) {
            throw new Error(
              "History cannot contain more than 10 messages"
            );
          }

          for (
            const item of
            history
          ) {
            if (
              !item ||
              typeof item !==
                "object" ||
              Array.isArray(
                item
              )
            ) {
              throw new Error(
                "Each history item must be an object"
              );
            }

            if (
              !ALLOWED_HISTORY_ROLES.has(
                item.role
              )
            ) {
              throw new Error(
                "History role must be user or model"
              );
            }

            if (
              typeof item.text !==
                "string"
            ) {
              throw new Error(
                "History text must be text"
              );
            }

            const trimmedText =
              item.text.trim();

            if (
              trimmedText.length ===
              0
            ) {
              throw new Error(
                "History text cannot be empty"
              );
            }

            if (
              trimmedText.length >
              1000
            ) {
              throw new Error(
                "Each history message cannot exceed 1000 characters"
              );
            }
          }

          return true;
        }
      ),
  ];