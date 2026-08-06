import {
  ACCOUNT_STATUS,
} from "../constants/auth.constants.js";

import AppError from "../utils/AppError.js";

export const validateUserCanAuthenticate = (user) => {
  if (!user.isEmailVerified) {
    throw new AppError(
      "Please verify your email address before logging in",
      403
    );
  }

  if (
    user.accountStatus ===
    ACCOUNT_STATUS.SUSPENDED
  ) {
    throw new AppError(
      "This account has been suspended",
      403
    );
  }

  if (
    user.accountStatus ===
    ACCOUNT_STATUS.DEACTIVATED
  ) {
    throw new AppError(
      "This account has been deactivated",
      403
    );
  }

  if (
    user.accountStatus !==
    ACCOUNT_STATUS.ACTIVE
  ) {
    throw new AppError(
      "This account is not active",
      403
    );
  }
};