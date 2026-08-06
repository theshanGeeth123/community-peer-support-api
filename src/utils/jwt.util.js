import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import AppError from "./AppError.js";

const getRequiredEnvironmentVariable = (variableName) => {
  const value = process.env[variableName];

  if (!value) {
    throw new AppError(
      `Missing required environment variable: ${variableName}`,
      500
    );
  }

  return value;
};

const getPositiveIntegerEnvironmentValue = (
  variableName,
  defaultValue
) => {
  const value = Number(
    process.env[variableName] || defaultValue
  );

  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(
      `${variableName} configuration is invalid`,
      500
    );
  }

  return value;
};

const getJwtConfiguration = () => ({
  secret: getRequiredEnvironmentVariable("JWT_SECRET"),

  expiresInSeconds: getPositiveIntegerEnvironmentValue(
    "JWT_EXPIRES_SECONDS",
    86400
  ),

  issuer:
    process.env.JWT_ISSUER ||
    "community-peer-support-api",

  audience:
    process.env.JWT_AUDIENCE ||
    "community-peer-support-mobile",
});

export const createAuthenticationToken = ({
  user,
  sessionId,
}) => {
  const configuration = getJwtConfiguration();

  const token = jwt.sign(
    {
      sid: sessionId.toString(),
      role: user.role,
      typ: "auth",
    },
    configuration.secret,
    {
      algorithm: "HS256",
      subject: user._id.toString(),
      issuer: configuration.issuer,
      audience: configuration.audience,
      expiresIn: configuration.expiresInSeconds,
      jwtid: crypto.randomUUID(),
    }
  );

  return {
    token,
    tokenType: "Bearer",
    expiresInSeconds: configuration.expiresInSeconds,
  };
};

export const verifyAuthenticationToken = (token) => {
  const configuration = getJwtConfiguration();

  try {
    const payload = jwt.verify(
      token,
      configuration.secret,
      {
        algorithms: ["HS256"],
        issuer: configuration.issuer,
        audience: configuration.audience,
      }
    );

    if (
      payload.typ !== "auth" ||
      !payload.sub ||
      !payload.sid
    ) {
      throw new Error("Invalid authentication-token payload");
    }

    return payload;
  } catch {
    throw new AppError(
      "Invalid or expired authentication token",
      401
    );
  }
};