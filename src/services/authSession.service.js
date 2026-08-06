import mongoose from "mongoose";

import AuthSession from "../models/AuthSession.js";

import {
  createAuthenticationToken,
} from "../utils/jwt.util.js";

import {
  hashToken,
} from "../utils/token.util.js";

const getClientMetadata = (request) => ({
  ipAddress: request.ip || null,

  userAgent:
    request.get("user-agent")?.slice(0, 500) ||
    null,
});

export const createAuthenticationSession = async ({
  user,
  request,
}) => {
  const sessionId =
    new mongoose.Types.ObjectId();

  const authenticationToken =
    createAuthenticationToken({
      user,
      sessionId,
    });

  const sessionExpiresAt = new Date(
    Date.now() +
      authenticationToken.expiresInSeconds * 1000
  );

  const clientMetadata =
    getClientMetadata(request);

  await AuthSession.create({
    _id: sessionId,

    user: user._id,

    tokenHash: hashToken(
      authenticationToken.token
    ),

    expiresAt: sessionExpiresAt,

    userAgent: clientMetadata.userAgent,
    createdByIp: clientMetadata.ipAddress,
    lastUsedIp: clientMetadata.ipAddress,
    lastUsedAt: new Date(),
  });

  user.lastLoginAt = new Date();

  await user.save({
    validateBeforeSave: false,
  });

  return authenticationToken;
};