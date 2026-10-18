
import { describe, it, expect } from "@jest/globals";

import {
  registerValidator,
  verifyEmailOtpValidator,
  loginValidator,
  resetPasswordValidator,
  changePasswordValidator,
  updateProfileValidator,
} from "../../validators/auth.validator.js";

import {
  ACCOUNT_STATUS,
} from "../../constants/auth.constants.js";

import {
  validateUserCanAuthenticate,
} from "../../services/authAccount.service.js";

import {
  checkRules,
  hasError,
} from "./runValidators.js";

const validRegistration = {
  fullName: "Test Student",
  email: "student@example.com",
  password: "StrongPass@123",
};

describe("TG - Registration and email verification", () => {

  it("AUTH-01: accepts valid registration data", async () => {
    const { errors } = await checkRules(registerValidator, {
      body: validRegistration,
    });

    expect(errors).toHaveLength(0);
  });

  it("AUTH-02: rejects invalid email", async () => {
    const { errors } = await checkRules(registerValidator, {
      body: {
        ...validRegistration,
        email: "invalid-email",
      },
    });

    expect(hasError(errors, "email")).toBe(true);
  });

  it("AUTH-03: rejects weak password", async () => {
    const { errors } = await checkRules(registerValidator, {
      body: {
        ...validRegistration,
        password: "password123",
      },
    });

    expect(hasError(errors, "password")).toBe(true);
  });

  it("AUTH-04: rejects too-short full name", async () => {
    const { errors } = await checkRules(registerValidator, {
      body: {
        ...validRegistration,
        fullName: "A",
      },
    });

    expect(hasError(errors, "fullName")).toBe(true);
  });

  it("AUTH-05: accepts valid six-digit OTP", async () => {
    const { errors } = await checkRules(verifyEmailOtpValidator, {
      body: {
        email: "student@example.com",
        otp: "123456",
      },
    });

    expect(errors).toHaveLength(0);
  });

  it("AUTH-06: rejects invalid OTP", async () => {
    const { errors } = await checkRules(verifyEmailOtpValidator, {
      body: {
        email: "student@example.com",
        otp: "12AB",
      },
    });

    expect(hasError(errors, "otp")).toBe(true);
  });

  it("AUTH-07: rejects empty login password", async () => {
    const { errors } = await checkRules(loginValidator, {
      body: {
        email: "student@example.com",
        password: "",
      },
    });

    expect(hasError(errors, "password")).toBe(true);
  });

  it("AUTH-08: rejects weak reset password", async () => {
    const { errors } = await checkRules(resetPasswordValidator, {
      body: {
        email: "student@example.com",
        otp: "123456",
        newPassword: "weak",
      },
    });

    expect(hasError(errors, "newPassword")).toBe(true);
  });

  it("AUTH-09: accepts valid password change", async () => {
    const { errors } = await checkRules(changePasswordValidator, {
      body: {
        currentPassword: "OldPassword@1",
        newPassword: "NewPassword@123",
      },
    });

    expect(errors).toHaveLength(0);
  });

});

describe("TG - Profile validation", () => {

  it("PROFILE-01: accepts valid name update", async () => {
    const { errors, req } = await checkRules(updateProfileValidator, {
      body: {
        fullName: "  Updated Name  ",
      },
    });

    expect(errors).toHaveLength(0);
    expect(req.body.fullName).toBe("Updated Name");
  });

  it("PROFILE-02: rejects empty update", async () => {
    const { errors } = await checkRules(updateProfileValidator, {
      body: {},
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it("PROFILE-03: blocks unauthorized profile field", async () => {
    const { errors } = await checkRules(updateProfileValidator, {
      body: {
        role: "ADMIN",
      },
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it("PROFILE-04: rejects invalid avatar URL", async () => {
    const { errors } = await checkRules(updateProfileValidator, {
      body: {
        avatarUrl: "not-a-url",
      },
    });

    expect(hasError(errors, "avatarUrl")).toBe(true);
  });

  it("PROFILE-05: accepts null avatar reference", async () => {
    const { errors } = await checkRules(updateProfileValidator, {
      body: {
        avatarUrl: null,
      },
    });

    expect(errors).toHaveLength(0);
  });

});

describe("TG - Account access rules", () => {

  const activeUser = {
    isEmailVerified: true,
    accountStatus: ACCOUNT_STATUS.ACTIVE,
  };

  it("ACCESS-01: allows verified active user", () => {
    expect(() =>
      validateUserCanAuthenticate(activeUser)
    ).not.toThrow();
  });

  it("ACCESS-02: blocks unverified user", () => {
    expect(() =>
      validateUserCanAuthenticate({
        ...activeUser,
        isEmailVerified: false,
      })
    ).toThrow(/verify your email/i);
  });

  it("ACCESS-03: blocks suspended account", () => {
    expect(() =>
      validateUserCanAuthenticate({
        ...activeUser,
        accountStatus: ACCOUNT_STATUS.SUSPENDED,
      })
    ).toThrow(/suspended/i);
  });

  it("ACCESS-04: blocks deactivated account", () => {
    expect(() =>
      validateUserCanAuthenticate({
        ...activeUser,
        accountStatus: ACCOUNT_STATUS.DEACTIVATED,
      })
    ).toThrow(/deactivated/i);
  });

});
