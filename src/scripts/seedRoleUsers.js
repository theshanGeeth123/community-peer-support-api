import "dotenv/config";

import mongoose from "mongoose";

import connectDatabase from "../config/database.js";
import User from "../models/User.js";

import {
  ACCOUNT_STATUS,
  AUTH_PROVIDERS,
  USER_ROLES,
} from "../constants/auth.constants.js";

const TEST_PASSWORD = "Test@12345";

const testUsers = [
  {
    fullName: "Test Normal User",
    email: "user.test@example.com",
    role: USER_ROLES.USER,
  },
  {
    fullName: "Test Peer Supporter",
    email: "peer.test@example.com",
    role: USER_ROLES.PEER_SUPPORTER,
  },
  {
    fullName: "Test Moderator",
    email: "moderator.test@example.com",
    role: USER_ROLES.MODERATOR,
  },
  {
    fullName: "Test Administrator",
    email: "admin.test@example.com",
    role: USER_ROLES.ADMIN,
  },
];

const seedRoleUsers = async () => {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    throw new Error(
      "Test users cannot be seeded in production."
    );
  }

  await connectDatabase();

  console.log(
    "\nCreating development test users...\n"
  );

  for (const testUser of testUsers) {
    const normalizedEmail =
      testUser.email
        .trim()
        .toLowerCase();

    let user =
      await User.findOne({
        email: normalizedEmail,
      }).select("+password");

    if (!user) {
      user = new User({
        fullName:
          testUser.fullName,

        email:
          normalizedEmail,

        password:
          TEST_PASSWORD,

        role:
          testUser.role,

        authProviders: [
          AUTH_PROVIDERS.LOCAL,
        ],

        isEmailVerified:
          true,

        accountStatus:
          ACCOUNT_STATUS.ACTIVE,
      });
    } else {
      user.fullName =
        testUser.fullName;

      user.password =
        TEST_PASSWORD;

      user.role =
        testUser.role;

      user.authProviders = [
        AUTH_PROVIDERS.LOCAL,
      ];

      user.isEmailVerified =
        true;

      user.accountStatus =
        ACCOUNT_STATUS.ACTIVE;

      user.emailVerificationOtpHash =
        null;

      user.emailVerificationOtpExpiresAt =
        null;

      user.emailVerificationOtpSentAt =
        null;

      user.emailVerificationOtpAttemptCount =
        0;

      user.passwordResetOtpHash =
        null;

      user.passwordResetOtpExpiresAt =
        null;

      user.passwordResetOtpSentAt =
        null;

      user.passwordResetOtpAttemptCount =
        0;
    }

    await user.save();

    console.log(
      `✓ ${testUser.role.padEnd(
        15
      )} ${normalizedEmail}`
    );
  }

  console.log(
    "\nDevelopment users created successfully."
  );

  console.log(
    "\nLogin password for all test users:"
  );

  console.log(
    TEST_PASSWORD
  );

  console.log(
    "\n----------------------------------------"
  );

  console.log(
    "USER           : user.test@example.com"
  );

  console.log(
    "PEER_SUPPORTER : peer.test@example.com"
  );

  console.log(
    "MODERATOR      : moderator.test@example.com"
  );

  console.log(
    "ADMIN          : admin.test@example.com"
  );

  console.log(
    "----------------------------------------\n"
  );
};

seedRoleUsers()
  .catch((error) => {
    console.error(
      "\nTest user seed failed:"
    );

    console.error(
      error.message
    );

    process.exitCode = 1;
  })
  .finally(
    async () => {
      await mongoose.disconnect();
    }
  );