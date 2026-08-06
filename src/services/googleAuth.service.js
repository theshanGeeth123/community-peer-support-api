import { OAuth2Client } from "google-auth-library";

import AppError from "../utils/AppError.js";

const googleOAuthClient = new OAuth2Client();

const getGoogleClientId = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new AppError(
      "Missing required environment variable: GOOGLE_CLIENT_ID",
      500
    );
  }

  return clientId;
};

export const verifyGoogleIdToken = async (idToken) => {
  const googleClientId = getGoogleClientId();

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      throw new Error(
        "Required Google identity information is missing"
      );
    }

    const fullName = (
      payload.name ||
      payload.given_name ||
      "Google User"
    )
      .trim()
      .slice(0, 80);

    return {
      googleId: payload.sub,
      email: payload.email.trim().toLowerCase(),
      fullName,
      avatarUrl: payload.picture || null,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Google ID token verification failed:",
        error.message
      );
    }

    throw new AppError(
      "Invalid or expired Google ID token",
      401
    );
  }
};