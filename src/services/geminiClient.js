import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/genai";

/*
|--------------------------------------------------------------------------
| SHARED GEMINI CLIENT (post features)
|--------------------------------------------------------------------------
|
| Used by the AI safety check and post translation. Both read member
| posts, so they share the same client, the same relaxed safety filters
| and the same "pause after an upstream error" behaviour.
|
*/

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/*
 * After a rate-limit or auth error, stop calling Gemini for a while
 * instead of failing on every request (the free tier has per-minute
 * and per-day limits).
 */
const RATE_LIMIT_PAUSE_MS = 60 * 1000;
const AUTH_ERROR_PAUSE_MS = 10 * 60 * 1000;

let geminiClient = null;
let pausedUntil = 0;

const getApiKey = () => process.env.GEMINI_API_KEY?.trim() || null;

export const isGeminiConfigured = () => Boolean(getApiKey());

export const getGeminiClient = () => {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: getApiKey() });
  }

  return geminiClient;
};

/**
 * @param {string} [overrideEnvName]  Env var that can pick a different
 *   model for one feature (e.g. "GEMINI_SAFETY_MODEL").
 */
export const getGeminiModel = (overrideEnvName) =>
  (overrideEnvName && process.env[overrideEnvName]?.trim()) ||
  process.env.GEMINI_MODEL?.trim() ||
  DEFAULT_MODEL;

export const isGeminiPaused = () => Date.now() < pausedUntil;

const getUpstreamStatus = (error) => {
  const value = Number(error?.status || error?.statusCode);

  return Number.isFinite(value) ? value : null;
};

/**
 * Turns a Gemini SDK error into a short reason, and pauses further
 * calls when the error will not fix itself straight away.
 *
 * @returns {"rate_limited" | "auth_error" | "upstream_error"}
 */
export const classifyGeminiError = (error, logLabel) => {
  const upstreamStatus = getUpstreamStatus(error);

  if (upstreamStatus === 429) {
    pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
    return "rate_limited";
  }

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    pausedUntil = Date.now() + AUTH_ERROR_PAUSE_MS;
    console.error(
      `[${logLabel}] Gemini rejected the API key. Check GEMINI_API_KEY.`
    );
    return "auth_error";
  }

  console.error(
    `[${logLabel}] Gemini request failed:`,
    error?.message ?? error
  );

  return "upstream_error";
};

/*
 * These features read and classify/translate member posts; they do not
 * generate harmful content. Gemini's default filters would block the
 * very posts that most need to be handled (distress, self-harm), so
 * they are relaxed for these requests only.
 */
export const POST_TEXT_SAFETY_SETTINGS = [
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
].map((category) => ({
  category,
  threshold: HarmBlockThreshold.BLOCK_NONE,
}));
