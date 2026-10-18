
import { describe, it, expect } from "@jest/globals";

import {
  listUsersValidator,
  updateUserRoleValidator,
  updateUserStatusValidator,
} from "../../validators/admin.validator.js";

import {
  ACCOUNT_STATUS,
  USER_ROLES,
} from "../../constants/auth.constants.js";

import {
  checkRules,
  hasError,
} from "./runValidators.js";

const userId = "507f1f77bcf86cd799439011";

describe("TG - Administrator user-management validation", () => {

  it("ADMIN-01: accepts valid user list filters", async () => {
    const { errors } = await checkRules(listUsersValidator, {
      query: {
        page: "1",
        limit: "20",
        role: USER_ROLES.USER,
      },
    });

    expect(errors).toHaveLength(0);
  });

  it("ADMIN-02: rejects page zero", async () => {
    const { errors } = await checkRules(listUsersValidator, {
      query: { page: "0" },
    });

    expect(hasError(errors, "page")).toBe(true);
  });

  it("ADMIN-03: rejects limit above 100", async () => {
    const { errors } = await checkRules(listUsersValidator, {
      query: { limit: "101" },
    });

    expect(hasError(errors, "limit")).toBe(true);
  });

  it("ADMIN-04: rejects invalid role filter", async () => {
    const { errors } = await checkRules(listUsersValidator, {
      query: { role: "SUPER_ADMIN" },
    });

    expect(hasError(errors, "role")).toBe(true);
  });

  it("ADMIN-05: accepts valid role update", async () => {
    const { errors } = await checkRules(updateUserRoleValidator, {
      params: { userId },
      body: {
        role: USER_ROLES.PEER_SUPPORTER,
      },
    });

    expect(errors).toHaveLength(0);
  });

  it("ADMIN-06: rejects invalid user ID", async () => {
    const { errors } = await checkRules(updateUserRoleValidator, {
      params: {
        userId: "not-an-object-id",
      },
      body: {
        role: USER_ROLES.ADMIN,
      },
    });

    expect(hasError(errors, "userId")).toBe(true);
  });

  it("ADMIN-07: rejects unsupported role", async () => {
    const { errors } = await checkRules(updateUserRoleValidator, {
      params: { userId },
      body: {
        role: "OWNER",
      },
    });

    expect(hasError(errors, "role")).toBe(true);
  });

  it("ADMIN-08: accepts valid account status", async () => {
    const { errors } = await checkRules(updateUserStatusValidator, {
      params: { userId },
      body: {
        accountStatus: ACCOUNT_STATUS.SUSPENDED,
      },
    });

    expect(errors).toHaveLength(0);
  });

  it("ADMIN-09: rejects unsupported account status", async () => {
    const { errors } = await checkRules(updateUserStatusValidator, {
      params: { userId },
      body: {
        accountStatus: "DELETED",
      },
    });

    expect(hasError(errors, "accountStatus")).toBe(true);
  });

});
