import express from "express";

import {
  sendChatbotMessage,
} from "../controllers/chatbot.controller.js";

import {
  chatbotLimiter,
} from "../middleware/rateLimit.middleware.js";

import validateRequest from "../middleware/validate.middleware.js";

import {
  sendChatbotMessageValidator,
} from "../validators/chatbot.validator.js";

const router = express.Router();

/*
 * PUBLIC CHATBOT ROUTE
 *
 * No authenticate middleware here.
 * Registered and unregistered users
 * can both access the chatbot.
 */

router.post(
  "/message",
  chatbotLimiter,
  sendChatbotMessageValidator,
  validateRequest,
  sendChatbotMessage
);

export default router;