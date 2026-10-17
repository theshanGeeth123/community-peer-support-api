/**
 * Integration tests for GET /api/v1/health and the 404 fallback.
 *
 * All external dependencies (cloudinary, mailer, mongoose) are
 * mocked with jest.unstable_mockModule so the Express app can be
 * imported without real credentials or a database connection.
 */

import { describe, it, expect, jest } from "@jest/globals";

// ------------------------------------------------------------------
// 1. Mock cloudinary config (throws on missing env vars)
// ------------------------------------------------------------------
jest.unstable_mockModule("../../config/cloudinary.js", () => ({
  default: {
    config: jest.fn(),
    uploader: { upload: jest.fn(), destroy: jest.fn() },
  },
}));

// ------------------------------------------------------------------
// 2. Mock nodemailer-based mailer
// ------------------------------------------------------------------
jest.unstable_mockModule("../../config/mailer.js", () => ({
  default: { sendMail: jest.fn() },
}));

// ------------------------------------------------------------------
// 3. Mock mongoose — models call new Schema(), schema.methods.xxx,
//    schema.pre(), schema.index(), mongoose.model(), etc.
// ------------------------------------------------------------------

class FakeSchema {
  constructor() {
    this.methods = {};
    this.statics = {};
    this.virtuals = {};
  }
  pre() { return this; }
  post() { return this; }
  index() { return this; }
  set() { return this; }
  virtual(name) {
    this.virtuals[name] = {};
    return { get: (fn) => { this.virtuals[name].get = fn; return this; } };
  }
  path() { return { get: jest.fn() }; }
}

// Static property accessed as: mongoose.Schema.Types.ObjectId
FakeSchema.Types = {
  ObjectId: "ObjectId",
  String,
  Number,
  Boolean,
  Date,
  Mixed: Object,
  Array,
};

// Also accessible as mongoose.Types.ObjectId (used in some models)
const fakeTypes = { ObjectId: "ObjectId" };

const fakeMongoose = {
  connect: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue({}),
  connection: { readyState: 0 },
  Schema: FakeSchema,
  model: jest.fn().mockReturnValue({}),
  models: {},
  Types: fakeTypes,
};

jest.unstable_mockModule("mongoose", () => ({
  default: fakeMongoose,
}));

// ------------------------------------------------------------------
// 4. Dynamic imports AFTER all mocks are registered
// ------------------------------------------------------------------
const { default: app } = await import("../../app.js");
const { default: request } = await import("supertest");

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe("GET /api/v1/health", () => {
  it("responds with HTTP 200", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
  });

  it("returns success: true", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.body.success).toBe(true);
  });

  it("returns a message confirming the API is running", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.body.message).toMatch(/running/i);
  });

  it("returns a valid ISO 8601 timestamp", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).toISOString()).toBe(
      res.body.timestamp
    );
  });

  it("returns a database status string", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(typeof res.body.database).toBe("string");
  });
});

describe("404 fallback handler", () => {
  // Use a path outside all mounted router prefixes so the request
  // falls through to notFoundHandler (not to the auth middleware
  // that guards the broadly-mounted /api/v1 post routes).
  const unknownPath = "/api/v99/does-not-exist-xyz";

  it("responds with HTTP 404 for unknown routes", async () => {
    const res = await request(app).get(unknownPath);
    expect(res.status).toBe(404);
  });

  it("returns success: false for unknown routes", async () => {
    const res = await request(app).get(unknownPath);
    expect(res.body.success).toBe(false);
  });

  it("includes the HTTP method and path in the error message", async () => {
    const res = await request(app).get(unknownPath);
    expect(res.body.message).toMatch(/GET/i);
    expect(res.body.message).toContain(unknownPath);
  });
});
