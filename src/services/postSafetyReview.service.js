import Post from "../models/Post.js";

import {
  AI_RISK_LEVEL,
  AI_RISK_SCORE,
  AI_SAFETY_STATUS,
  CONTENT_WARNING,
  CRISIS_FLAG_SOURCE,
} from "../constants/post.constants.js";

import { analyzePostSafety } from "./aiSafety.service.js";

/*
|--------------------------------------------------------------------------
| POST SAFETY REVIEW
|--------------------------------------------------------------------------
|
| Runs the AI safety check for a saved post and applies the result.
|
| - HIGH / URGENT risk raises the crisis flag (if keywords had not
|   already) and covers the post with content warnings.
| - The AI can raise a flag but never clears one: a keyword flag stays
|   even when the AI sees no risk. Staff see the AI's view beside it and
|   decide.
| - A flag that staff already handled is never re-opened.
|
*/

const CRISIS_RISK_LEVELS = new Set([
  AI_RISK_LEVEL.HIGH,
  AI_RISK_LEVEL.URGENT,
]);

const applyAiResult = async (postId, result) => {
  const checkedAt = new Date();

  if (result.status !== AI_SAFETY_STATUS.DONE) {
    await Post.updateOne(
      { _id: postId },
      {
        $set: {
          "aiSafety.status": result.status,
          "aiSafety.checkedAt": checkedAt,
        },
      }
    );

    return { status: result.status, isCrisis: false, riskLevel: null };
  }

  const aiFields = {
    "aiSafety.status": AI_SAFETY_STATUS.DONE,
    "aiSafety.riskLevel": result.riskLevel,
    "aiSafety.riskScore": AI_RISK_SCORE[result.riskLevel] ?? 0,
    "aiSafety.mood": result.mood,
    "aiSafety.reason": result.reason,
    "aiSafety.suggestedWarnings": result.contentWarnings,
    "aiSafety.model": result.model,
    "aiSafety.checkedAt": checkedAt,

    /*
     * The AI also reports the post's language. It is more accurate
     * than the alphabet check (it recognises Sinhala typed in English
     * letters), so it replaces that when present.
     */
    ...(result.language ? { language: result.language } : {}),
  };

  const isCrisis = CRISIS_RISK_LEVELS.has(result.riskLevel);

  if (!isCrisis) {
    await Post.updateOne({ _id: postId }, { $set: aiFields });

    return { status: result.status, isCrisis, riskLevel: result.riskLevel };
  }

  /*
   * Crisis posts are always covered for other members, with the
   * suicide/self-harm warning plus whatever else the AI identified.
   */
  const warnings = {
    contentWarnings: {
      $each: [CONTENT_WARNING.SUICIDE_SELF_HARM, ...result.contentWarnings],
    },
  };

  /*
   * Not flagged yet → the AI raises the flag.
   */
  const raised = await Post.updateOne(
    { _id: postId, "crisisFlag.isFlagged": { $ne: true } },
    {
      $set: {
        ...aiFields,
        "crisisFlag.isFlagged": true,
        "crisisFlag.flaggedAt": checkedAt,
        "crisisFlag.source": CRISIS_FLAG_SOURCE.AI,
      },
      $addToSet: warnings,
    }
  );

  if (raised.modifiedCount === 0) {
    /*
     * Keywords flagged it first → the AI agrees. Handled state is
     * left exactly as it is.
     */
    await Post.updateOne(
      { _id: postId },
      {
        $set: {
          ...aiFields,
          "crisisFlag.source": CRISIS_FLAG_SOURCE.BOTH,
        },
        $addToSet: warnings,
      }
    );
  }

  return { status: result.status, isCrisis, riskLevel: result.riskLevel };
};

/**
 * Reviews one saved post with the AI and stores the outcome.
 * Never throws — on any problem the post simply keeps its keyword
 * result.
 *
 * @param {{ _id: unknown, content: string }} post
 * @param {object} [options]  Passed to analyzePostSafety (tests).
 * @returns {Promise<{ status: string, isCrisis: boolean,
 *                     riskLevel: string | null }>}
 */
export const reviewPostWithAi = async (post, options) => {
  try {
    const result = await analyzePostSafety(post.content, options);

    return await applyAiResult(post._id, result);
  } catch (error) {
    console.error(
      "[ai safety] Could not review post:",
      error?.message ?? error
    );

    return {
      status: AI_SAFETY_STATUS.FAILED,
      isCrisis: false,
      riskLevel: null,
    };
  }
};

/**
 * Resolves with the promise's value, or null if it takes longer than
 * `ms`. The promise keeps running in the background either way.
 */
export const waitUpTo = (promise, ms) => {
  let timer;

  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};
