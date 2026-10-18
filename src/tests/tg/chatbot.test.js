
import { describe, it, expect } from "@jest/globals";

import {
  sendChatbotMessageValidator,
} from "../../validators/chatbot.validator.js";

import {
  checkRules,
  hasError,
} from "./runValidators.js";

const validateChat = (body) =>
  checkRules(sendChatbotMessageValidator, { body });

describe("TG - Public knowledge chatbot input validation", () => {

  it("CHAT-01: accepts normal user question", async () => {
    const { errors } = await validateChat({
      message: "How do I join a group?",
    });

    expect(errors).toHaveLength(0);
  });

  it("CHAT-02: trims message whitespace", async () => {
    const { errors, req } = await validateChat({
      message: "  How do I register?  ",
    });

    expect(errors).toHaveLength(0);
    expect(req.body.message).toBe("How do I register?");
  });

  it("CHAT-03: rejects missing message", async () => {
    const { errors } = await validateChat({});

    expect(hasError(errors, "message")).toBe(true);
  });

  it("CHAT-04: rejects blank message", async () => {
    const { errors } = await validateChat({
      message: "   ",
    });

    expect(hasError(errors, "message")).toBe(true);
  });

  it("CHAT-05: rejects message longer than 1000 characters", async () => {
    const { errors } = await validateChat({
      message: "a".repeat(1001),
    });

    expect(hasError(errors, "message")).toBe(true);
  });

  it("CHAT-06: rejects non-string message", async () => {
    const { errors } = await validateChat({
      message: 123,
    });

    expect(hasError(errors, "message")).toBe(true);
  });

  it("CHAT-07: accepts valid conversation history", async () => {
    const { errors } = await validateChat({
      message: "What about joining?",
      history: [
        {
          role: "user",
          text: "Hello",
        },
        {
          role: "model",
          text: "Welcome",
        },
      ],
    });

    expect(errors).toHaveLength(0);
  });

  it("CHAT-08: rejects history exceeding 10 messages", async () => {
    const { errors } = await validateChat({
      message: "Question",
      history: Array(11).fill({
        role: "user",
        text: "Hi",
      }),
    });

    expect(hasError(errors, "history")).toBe(true);
  });

  it("CHAT-09: rejects unsupported history role", async () => {
    const { errors } = await validateChat({
      message: "Question",
      history: [
        {
          role: "system",
          text: "Hello",
        },
      ],
    });

    expect(hasError(errors, "history")).toBe(true);
  });

  it("CHAT-10: rejects empty history text", async () => {
    const { errors } = await validateChat({
      message: "Question",
      history: [
        {
          role: "user",
          text: " ",
        },
      ],
    });

    expect(hasError(errors, "history")).toBe(true);
  });

  it("CHAT-11: rejects history that is not an array", async () => {
    const { errors } = await validateChat({
      message: "Question",
      history: "hello",
    });

    expect(hasError(errors, "history")).toBe(true);
  });

});
