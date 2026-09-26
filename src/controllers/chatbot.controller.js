import asyncHandler from "../utils/asyncHandler.js";

import {
  generateChatbotAnswer,
} from "../services/chatbot.service.js";

import {
  getCrisisSupportResponse,
  isPotentialCrisisMessage,
} from "../services/chatbotSafety.service.js";

export const sendChatbotMessage =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const message =
        req.body.message.trim();

      const history =
        Array.isArray(
          req.body.history
        )
          ? req.body.history
          : [];

      /*
       * Important:
       *
       * This endpoint is intentionally PUBLIC.
       * No req.user is required.
       *
       * Both registered and unregistered
       * visitors can use the chatbot.
       */

      if (
        isPotentialCrisisMessage(
          message
        )
      ) {
        return res
          .status(200)
          .json({
            success: true,

            message:
              "Safety support response generated.",

            data: {
              answer:
                getCrisisSupportResponse(),

              responseType:
                "SAFETY",
            },
          });
      }

      const answer =
        await generateChatbotAnswer(
          {
            message,
            history,
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Chatbot response generated successfully.",

          data: {
            answer,

            responseType:
              "KNOWLEDGE_BASE",
          },
        });
    }
  );