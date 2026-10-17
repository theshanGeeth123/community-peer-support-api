import { describe, it, expect, beforeAll } from "@jest/globals";
import {
  createAuthenticationToken,
  verifyAuthenticationToken,
} from "../../utils/jwt.util.js";

/**
 * Minimal mock objects for the JWT helpers.
 * No database or Express server needed.
 */
const mockUser = {
  _id: { toString: () => "6123456789abcdef01234567" },
  role: "user",
};

const mockSessionId = {
  toString: () => "7fedcba987654321fedcba98",
};

beforeAll(() => {
  // Provide the minimum env vars required by jwt.util.js
  process.env.JWT_SECRET = "test-secret-for-jest-do-not-use-in-prod";
  process.env.JWT_EXPIRES_SECONDS = "3600";
  process.env.JWT_ISSUER = "community-peer-support-api";
  process.env.JWT_AUDIENCE = "community-peer-support-mobile";
});

describe("createAuthenticationToken", () => {
  it("should return a token string, tokenType, and expiresInSeconds", () => {
    const result = createAuthenticationToken({
      user: mockUser,
      sessionId: mockSessionId,
    });

    expect(typeof result.token).toBe("string");
    expect(result.tokenType).toBe("Bearer");
    expect(result.expiresInSeconds).toBe(3600);
  });

  it("should create a token with three JWT segments", () => {
    const { token } = createAuthenticationToken({
      user: mockUser,
      sessionId: mockSessionId,
    });
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
  });
});

describe("verifyAuthenticationToken", () => {
  it("should verify a freshly created token and return the payload", () => {
    const { token } = createAuthenticationToken({
      user: mockUser,
      sessionId: mockSessionId,
    });

    const payload = verifyAuthenticationToken(token);

    expect(payload.sub).toBe(mockUser._id.toString());
    expect(payload.sid).toBe(mockSessionId.toString());
    expect(payload.role).toBe(mockUser.role);
    expect(payload.typ).toBe("auth");
  });

  it("should throw AppError (401) for a tampered token", () => {
    const { token } = createAuthenticationToken({
      user: mockUser,
      sessionId: mockSessionId,
    });

    const tampered = token.slice(0, -5) + "XXXXX";

    expect(() => verifyAuthenticationToken(tampered)).toThrow();
  });

  it("should throw AppError (401) for an empty string", () => {
    expect(() => verifyAuthenticationToken("")).toThrow();
  });

  it("should throw AppError (401) for a random garbage string", () => {
    expect(() => verifyAuthenticationToken("not.a.token")).toThrow();
  });

  it("should throw AppError (401) for a token signed with wrong secret", () => {
    // Sign with a different secret
    import("jsonwebtoken").then(({ default: jwt }) => {
      const badToken = jwt.sign(
        { sub: "abc", sid: "def", typ: "auth", role: "user" },
        "wrong-secret",
        { algorithm: "HS256", issuer: "community-peer-support-api", audience: "community-peer-support-mobile" }
      );
      expect(() => verifyAuthenticationToken(badToken)).toThrow();
    });
  });
});
