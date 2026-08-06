import "dotenv/config";

import mongoose from "mongoose";

import {
  ACCOUNT_STATUS,
  USER_ROLES,
} from "../constants/auth.constants.js";

import connectDatabase from "../config/database.js";
import User from "../models/User.js";

const promoteAdmin = async () => {
  const suppliedEmail = process.argv[2];

  if (!suppliedEmail) {
    throw new Error(
      "Usage: npm run admin:promote -- user@example.com"
    );
  }

  const normalizedEmail =
    suppliedEmail.trim().toLowerCase();

  await connectDatabase();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    throw new Error(
      "Register and verify this user before promoting the account"
    );
  }

  if (!user.isEmailVerified) {
    throw new Error(
      "The account must be email verified before becoming an admin"
    );
  }

  user.role = USER_ROLES.ADMIN;
  user.accountStatus = ACCOUNT_STATUS.ACTIVE;

  await user.save({
    validateBeforeSave: false,
  });

  console.log(
    `Admin role assigned successfully: ${user.email}`
  );
};

promoteAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });