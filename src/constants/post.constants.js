export const POST_SORT = Object.freeze({
  NEWEST: "newest",
  MOST_SUPPORTED: "most_supported",
  MOST_DISCUSSED: "most_discussed",
  UNANSWERED: "unanswered",
});

/*
 * AI safety check (Gemini). Order matters: later = more serious.
 */
export const AI_RISK_LEVEL = Object.freeze({
  NONE: "NONE",
  LOW: "LOW",
  HIGH: "HIGH",
  URGENT: "URGENT",
});

/*
 * Numeric rank so posts can be sorted "most serious first".
 */
export const AI_RISK_SCORE = Object.freeze({
  NONE: 0,
  LOW: 1,
  HIGH: 2,
  URGENT: 3,
});

export const AI_SAFETY_STATUS = Object.freeze({
  PENDING: "PENDING",
  DONE: "DONE",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
});

export const AI_MOOD = Object.freeze({
  POSITIVE: "POSITIVE",
  NEUTRAL: "NEUTRAL",
  SAD: "SAD",
  ANXIOUS: "ANXIOUS",
  ANGRY: "ANGRY",
  HOPELESS: "HOPELESS",
});

export const CRISIS_FLAG_SOURCE = Object.freeze({
  KEYWORD: "KEYWORD",
  AI: "AI",
  BOTH: "BOTH",
});

export const CONTENT_WARNING = Object.freeze({
  SUICIDE_SELF_HARM: "SUICIDE_SELF_HARM",
  EATING_DISORDERS: "EATING_DISORDERS",
  ABUSE: "ABUSE",
  GRIEF: "GRIEF",
  SUBSTANCE_USE: "SUBSTANCE_USE",
  VIOLENCE: "VIOLENCE",
});
