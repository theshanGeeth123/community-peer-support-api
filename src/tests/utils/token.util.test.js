import { describe, it, expect } from "@jest/globals";
import {
  generateSixDigitOtp,
  hashToken,
  securelyCompareToken,
} from "../../utils/token.util.js";

describe("generateSixDigitOtp", () => {
  it("should return a string", () => {
    const otp = generateSixDigitOtp();
    expect(typeof otp).toBe("string");
  });

  it("should be exactly 6 digits", () => {
    const otp = generateSixDigitOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("should produce different values on successive calls", () => {
    const results = new Set(
      Array.from({ length: 20 }, () => generateSixDigitOtp())
    );
    // With 900000 possible values, 20 calls should almost certainly differ
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("hashToken", () => {
  it("should return a hex string", () => {
    const hash = hashToken("123456");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should produce the same hash for the same input", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("should produce different hashes for different inputs", () => {
    expect(hashToken("abc")).not.toBe(hashToken("xyz"));
  });

  it("should coerce numbers to strings", () => {
    // hashToken calls String(value), so number 123456 === string "123456"
    expect(hashToken(123456)).toBe(hashToken("123456"));
  });
});

describe("securelyCompareToken", () => {
  it("should return true for matching plain value and hash", () => {
    const plain = "secret-otp";
    const hash = hashToken(plain);
    expect(securelyCompareToken(plain, hash)).toBe(true);
  });

  it("should return false for wrong plain value", () => {
    const hash = hashToken("correct");
    expect(securelyCompareToken("wrong", hash)).toBe(false);
  });

  it("should return false when plainValue is falsy", () => {
    const hash = hashToken("something");
    expect(securelyCompareToken(null, hash)).toBe(false);
    expect(securelyCompareToken("", hash)).toBe(false);
    expect(securelyCompareToken(undefined, hash)).toBe(false);
  });

  it("should return false when storedHash is falsy", () => {
    expect(securelyCompareToken("something", null)).toBe(false);
    expect(securelyCompareToken("something", "")).toBe(false);
  });
});
