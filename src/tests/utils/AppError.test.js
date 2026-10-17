import { describe, it, expect } from "@jest/globals";
import AppError from "../../utils/AppError.js";

describe("AppError", () => {
  it("should create an error with correct message and statusCode", () => {
    const error = new AppError("Something went wrong", 400);
    expect(error.message).toBe("Something went wrong");
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe("AppError");
  });

  it("should extend Error", () => {
    const error = new AppError("test", 500);
    expect(error).toBeInstanceOf(Error);
  });

  it("should store optional details", () => {
    const details = [{ field: "email", message: "invalid" }];
    const error = new AppError("Validation failed", 422, details);
    expect(error.details).toEqual(details);
  });

  it("should have null details by default", () => {
    const error = new AppError("test", 404);
    expect(error.details).toBeNull();
  });

  it("should have a stack trace", () => {
    const error = new AppError("test", 500);
    expect(error.stack).toBeDefined();
  });
});
