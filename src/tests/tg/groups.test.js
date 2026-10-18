
import { describe, it, expect } from "@jest/globals";

import {
  createGroupValidator,
  updateGroupValidator,
  groupAssignmentValidator,
} from "../../validators/group.validator.js";

import {
  joinGroupValidator,
  reviewJoinRequestValidator,
  moderateMembershipValidator,
} from "../../validators/groupMembership.validator.js";

import {
  GROUP_STATUS,
} from "../../constants/group.constants.js";

import {
  checkRules,
  hasError,
} from "./runValidators.js";

const groupId = "507f1f77bcf86cd799439011";
const userId = "507f191e810c19729de860ea";

const group = {
  name: "Student Support Circle",
  description: "A friendly community for students to support one another.",
  category: "Wellbeing",
  rules: ["Be respectful to everyone"],
};

describe("TG - Support group management", () => {

  it("GROUP-01: accepts valid group creation", async () => {
    const { errors } = await checkRules(createGroupValidator, {
      body: group,
    });

    expect(errors).toHaveLength(0);
  });

  it("GROUP-02: rejects short group name", async () => {
    const { errors } = await checkRules(createGroupValidator, {
      body: {
        ...group,
        name: "AB",
      },
    });

    expect(hasError(errors, "name")).toBe(true);
  });

  it("GROUP-03: rejects missing description", async () => {
    const { errors } = await checkRules(createGroupValidator, {
      body: {
        name: group.name,
        category: group.category,
      },
    });

    expect(hasError(errors, "description")).toBe(true);
  });

  it("GROUP-04: rejects more than 20 rules", async () => {
    const { errors } = await checkRules(createGroupValidator, {
      body: {
        ...group,
        rules: Array(21).fill("Please respect others"),
      },
    });

    expect(hasError(errors, "rules")).toBe(true);
  });

  it("GROUP-05: rejects too-short group rule", async () => {
    const { errors } = await checkRules(createGroupValidator, {
      body: {
        ...group,
        rules: ["No"],
      },
    });

    expect(
      hasError(errors, "rules[0]") ||
      hasError(errors, "rules.0")
    ).toBe(true);
  });

  it("GROUP-06: accepts valid group update", async () => {
    const { errors } = await checkRules(updateGroupValidator, {
      params: { groupId },
      body: {
        status: GROUP_STATUS.INACTIVE,
      },
    });

    expect(errors).toHaveLength(0);
  });

  it("GROUP-07: rejects empty group update", async () => {
    const { errors } = await checkRules(updateGroupValidator, {
      params: { groupId },
      body: {},
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it("GROUP-08: rejects invalid group status", async () => {
    const { errors } = await checkRules(updateGroupValidator, {
      params: { groupId },
      body: {
        status: "ARCHIVED",
      },
    });

    expect(hasError(errors, "status")).toBe(true);
  });

  it("GROUP-09: rejects invalid assignment IDs", async () => {
    const { errors } = await checkRules(groupAssignmentValidator, {
      params: {
        groupId: "invalid",
        userId: "invalid",
      },
    });

    expect(hasError(errors, "groupId")).toBe(true);
    expect(hasError(errors, "userId")).toBe(true);
  });

});

describe("TG - Group membership and join requests", () => {

  it("JOIN-01: accepts valid join request", async () => {
    const { errors } = await checkRules(joinGroupValidator, {
      params: { groupId },
      body: {
        reason: "I would like to participate in this community.",
      },
    });

    expect(errors).toHaveLength(0);
  });

  it("JOIN-02: rejects short join reason", async () => {
    const { errors } = await checkRules(joinGroupValidator, {
      params: { groupId },
      body: {
        reason: "Hi",
      },
    });

    expect(hasError(errors, "reason")).toBe(true);
  });

  it("JOIN-03: rejects invalid join request ID", async () => {
    const { errors } = await checkRules(reviewJoinRequestValidator, {
      params: {
        requestId: "bad-id",
      },
      body: {
        reviewNote: "Reviewed",
      },
    });

    expect(hasError(errors, "requestId")).toBe(true);
  });

  it("JOIN-04: rejects review note above 500 characters", async () => {
    const { errors } = await checkRules(reviewJoinRequestValidator, {
      params: {
        requestId: userId,
      },
      body: {
        reviewNote: "x".repeat(501),
      },
    });

    expect(hasError(errors, "reviewNote")).toBe(true);
  });

  it("JOIN-05: rejects membership moderation without reason", async () => {
    const { errors } = await checkRules(moderateMembershipValidator, {
      params: {
        membershipId: userId,
      },
      body: {},
    });

    expect(hasError(errors, "reason")).toBe(true);
  });

});
