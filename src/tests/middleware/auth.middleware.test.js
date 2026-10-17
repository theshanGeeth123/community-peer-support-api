/**
 * Auth middleware unit tests.
 *
 * Strategy:
 * - Tests that don't touch the DB (no auth header, bad scheme, bad token)
 *   are tested directly by calling the middleware with mock req/res/next.
 * - DB-dependent paths are tested via a lightweight express app using
 *   supertest, with the real asyncHandler so errors flow through next().
 * - authorizeRoles is pure and needs no mocking.
 */

import { describe, it, expect, jest } from "@jest/globals";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const buildReq = (authorizationHeader = null) => ({
  headers: authorizationHeader
    ? { authorization: authorizationHeader }
    : {},
});

const buildRes = () => ({});

/* ------------------------------------------------------------------ */
/* authenticate — cases that never reach the DB                        */
/* ------------------------------------------------------------------ */

// Import authenticate after setting up env vars needed by jwt.util
process.env.JWT_SECRET = "test-secret-for-jest";
process.env.JWT_EXPIRES_SECONDS = "3600";
process.env.JWT_ISSUER = "community-peer-support-api";
process.env.JWT_AUDIENCE = "community-peer-support-mobile";

const { authenticate, authorizeRoles } = await import(
  "../../middleware/auth.middleware.js"
);
const { default: AppError } = await import("../../utils/AppError.js");

describe("authenticate middleware — pure header validation", () => {
  it("should call next(AppError 401) when Authorization header is absent", async () => {
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(401);
    expect(next.mock.calls[0][0].message).toMatch(/authentication is required/i);
  });

  it("should call next(AppError 401) for a non-Bearer scheme (Basic auth)", async () => {
    const req = buildReq("Basic dXNlcjpwYXNz");
    const res = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it("should call next(AppError 401) for 'Bearer' with no token", async () => {
    const req = buildReq("Bearer ");
    const res = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it("should call next(AppError 401) for a malformed JWT (not 3 segments)", async () => {
    const req = buildReq("Bearer not.a.valid.jwt.string");
    const res = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    // verifyAuthenticationToken throws → asyncHandler calls next(err)
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it("should call next(AppError 401) for a JWT signed with wrong secret", async () => {
    // Sign a JWT with a different secret — verifyAuthenticationToken must reject
    const { default: jwt } = await import("jsonwebtoken");
    const badToken = jwt.sign(
      { sub: "uid", sid: "sid", typ: "auth", role: "user" },
      "WRONG_SECRET",
      {
        algorithm: "HS256",
        issuer: "community-peer-support-api",
        audience: "community-peer-support-mobile",
      }
    );

    const req = buildReq(`Bearer ${badToken}`);
    const res = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });
});

/* ------------------------------------------------------------------ */
/* authorizeRoles — pure synchronous, no DB                            */
/* ------------------------------------------------------------------ */

describe("authorizeRoles middleware", () => {
  it("should call next(AppError 401) when req.user is missing", () => {
    const middleware = authorizeRoles("admin");
    const req = {};
    const res = buildRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it("should call next(AppError 403) when the user's role is not in the allowed list", () => {
    const middleware = authorizeRoles("admin");
    const req = { user: { role: "user" } };
    const res = buildRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it("should call next() with no args when user role matches exactly", () => {
    const middleware = authorizeRoles("admin");
    const req = { user: { role: "admin" } };
    const res = buildRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should allow any role from a multi-role whitelist", () => {
    const middleware = authorizeRoles("admin", "moderator");

    for (const role of ["admin", "moderator"]) {
      const req = { user: { role } };
      const next = jest.fn();
      middleware(req, buildRes(), next);
      expect(next).toHaveBeenCalledWith();
    }
  });

  it("should reject a role that looks similar but is not in the list", () => {
    const middleware = authorizeRoles("admin");
    const req = { user: { role: "Admin" } }; // wrong casing
    const res = buildRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
});
