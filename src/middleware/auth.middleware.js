import AuthSession from "../models/AuthSession.js";
import User from "../models/User.js";

import {
  ACCOUNT_STATUS,
} from "../constants/auth.constants.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

import {
  verifyAuthenticationToken,
} from "../utils/jwt.util.js";

import {
  securelyCompareToken,
} from "../utils/token.util.js";

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] =
    authorizationHeader.trim().split(/\s+/);

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
};

const wasPasswordChangedAfterTokenIssued = (
  user,
  tokenIssuedAt
) => {
  if (!user.passwordChangedAt || !tokenIssuedAt) {
    return false;
  }

  const passwordChangedTimestamp = Math.floor(
    user.passwordChangedAt.getTime() / 1000
  );

  return passwordChangedTimestamp > tokenIssuedAt;
};

export const authenticate = asyncHandler(
  async (req, res, next) => {
    const token = getBearerToken(
      req.headers.authorization
    );

    if (!token) {
      throw new AppError(
        "Authentication is required",
        401
      );
    }

    const payload =
      verifyAuthenticationToken(token);

    const [user, session] = await Promise.all([
      User.findById(payload.sub),

      AuthSession.findById(payload.sid).select(
        "+tokenHash"
      ),
    ]);

    if (!user || !session) {
      throw new AppError(
        "Authentication session is invalid",
        401
      );
    }

    if (
      session.user.toString() !==
      user._id.toString()
    ) {
      throw new AppError(
        "Authentication session is invalid",
        401
      );
    }

    if (session.revokedAt) {
      throw new AppError(
        "Authentication session has been revoked",
        401
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AppError(
        "Authentication session has expired",
        401
      );
    }

    const isStoredTokenValid =
      securelyCompareToken(
        token,
        session.tokenHash
      );

    if (!isStoredTokenValid) {
      throw new AppError(
        "Authentication token does not match the active session",
        401
      );
    }

    if (!user.isEmailVerified) {
      throw new AppError(
        "Email verification is required",
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

    if (
      wasPasswordChangedAfterTokenIssued(
        user,
        payload.iat
      )
    ) {
      throw new AppError(
        "Your password was changed after this token was issued. Please log in again.",
        401
      );
    }

    req.user = user;

    req.auth = {
      sessionId: session._id.toString(),
      tokenId: payload.jti,
      tokenIssuedAt: payload.iat,
    };

    next();
  }
);