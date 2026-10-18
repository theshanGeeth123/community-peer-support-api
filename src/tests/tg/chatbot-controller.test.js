
import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from "@jest/globals";

// Mock Gemini answer service.
const generateChatbotAnswer = jest.fn();

jest.unstable_mockModule(
  "../../services/chatbot.service.js",
  () => ({
    generateChatbotAnswer,
  })
);

const {
  sendChatbotMessage,
} = await import("../../controllers/chatbot.controller.js");

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const flushPromises = () =>
  new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  generateChatbotAnswer.mockReset();
});

describe("TG - Public chatbot controller", () => {

  it("FLOW-01: serves unregistered visitor", async () => {
    generateChatbotAnswer.mockResolvedValue(
      "Open the groups page."
    );

    const req = {
      body: {
        message: "  How do I find groups?  ",
      },
    };

    const res = makeResponse();
    const next = jest.fn();

    sendChatbotMessage(req, res, next);
    await flushPromises();

    expect(next).not.toHaveBeenCalled();

    expect(generateChatbotAnswer).toHaveBeenCalledWith({
      message: "How do I find groups?",
      history: [],
    });

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: {
          answer: "Open the groups page.",
          responseType: "KNOWLEDGE_BASE",
        },
      })
    );
  });

  it("FLOW-02: forwards conversation history", async () => {
    generateChatbotAnswer.mockResolvedValue(
      "Here is more information."
    );

    const history = [
      {
        role: "user",
        text: "Hello",
      },
    ];

    const res = makeResponse();

    sendChatbotMessage(
      {
        body: {
          message: "Tell me more",
          history,
        },
      },
      res,
      jest.fn()
    );

    await flushPromises();

    expect(generateChatbotAnswer).toHaveBeenCalledWith({
      message: "Tell me more",
      history,
    });
  });

  it("FLOW-03: uses safety response branch for urgent language", async () => {
    const res = makeResponse();

    sendChatbotMessage(
      {
        body: {
          message: "immediate danger",
        },
      },
      res,
      jest.fn()
    );

    await flushPromises();

    expect(generateChatbotAnswer).not.toHaveBeenCalled();

    const responseBody = res.json.mock.calls[0][0];

    expect(responseBody.data.responseType).toBe("SAFETY");
  });

  it("FLOW-04: forwards AI service failure", async () => {
    const failure = new Error("AI service unavailable");

    generateChatbotAnswer.mockRejectedValue(failure);

    const next = jest.fn();

    sendChatbotMessage(
      {
        body: {
          message: "What is this platform?",
        },
      },
      makeResponse(),
      next
    );

    await flushPromises();

    expect(next).toHaveBeenCalledWith(failure);
  });

});
