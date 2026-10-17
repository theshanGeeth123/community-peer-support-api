import { describe, it, expect, jest } from "@jest/globals";
import { globalErrorHandler, notFoundHandler } from "../../middleware/error.middleware.js";
import AppError from "../../utils/AppError.js";

/**
 * Lightweight helpers to create mock req/res/next objects.
 */
const mockReq = (overrides = {}) => ({
  method: "GET",
  originalUrl: "/api/v1/missing",
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

describe("notFoundHandler", () => {
  it("should call next with an AppError (404)", () => {
    const req = mockReq({ method: "POST", originalUrl: "/api/v1/unknown" });
    const res = mockRes();
    const next = jest.fn();

    notFoundHandler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(404);
    expect(next.mock.calls[0][0].message).toContain("POST");
    expect(next.mock.calls[0][0].message).toContain("/api/v1/unknown");
  });
});

describe("globalErrorHandler", () => {
  it("should respond with the error statusCode and message for AppError", () => {
    const error = new AppError("Not found", 404);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    globalErrorHandler(error, req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Not found");
  });

  it("should default to 500 for non-AppErrors", () => {
    const error = new Error("Unexpected boom");
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    globalErrorHandler(error, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it("should handle MongoDB duplicate key error (code 11000) as 409", () => {
    const error = {
      code: 11000,
      keyValue: { email: "test@example.com" },
      message: "dup key",
    };
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    globalErrorHandler(error, req, res, next);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toContain("email");
  });

  it("should handle Mongoose ValidationError as 422", () => {
    const error = {
      name: "ValidationError",
      errors: {
        email: {
          path: "email",
          message: "Email is required",
        },
      },
      message: "Validation failed",
    };
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    globalErrorHandler(error, req, res, next);

    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].field).toBe("email");
  });

  it("should handle Mongoose CastError as 400", () => {
    const error = {
      name: "CastError",
      path: "_id",
      message: "Cast to ObjectId failed",
    };
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    globalErrorHandler(error, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("_id");
  });

  it("should include errors array in response when AppError has details", () => {
    const details = [{ field: "name", message: "required" }];
    const error = new AppError("Validation failed", 422, details);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    globalErrorHandler(error, req, res, next);

    expect(res.body.errors).toEqual(details);
  });

  it("should NOT include debug key in non-development mode", () => {
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const error = new AppError("test", 500);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    globalErrorHandler(error, req, res, next);

    expect(res.body.debug).toBeUndefined();
    process.env.NODE_ENV = savedEnv;
  });
});
