/*
|--------------------------------------------------------------------------
| CONTENT SAFETY — CRISIS KEYWORD DETECTION
|--------------------------------------------------------------------------
|
| First-line check for posts that may indicate a risk of suicide or
| self-harm. A match does NOT block the post — it flags it so that group
| staff can reach out, and shows the author crisis support resources.
|
| This is intentionally simple keyword matching. It will miss some
| messages and occasionally flag harmless ones, so it must never replace
| human review.
|
*/

const CRISIS_PATTERNS = [
  { label: "suicide", pattern: /\bsuicid(?:e|al)\b/i },
  { label: "kill myself", pattern: /\bkill(?:ing)? my ?self\b/i },
  { label: "end my life", pattern: /\bend(?:ing)? (?:my|this) life\b/i },
  { label: "take my own life", pattern: /\btak(?:e|ing) my (?:own )?life\b/i },
  { label: "want to die", pattern: /\b(?:want to|wanna) die\b/i },
  { label: "end it all", pattern: /\bend it all\b/i },
  { label: "better off dead", pattern: /\bbetter off dead\b/i },
  { label: "better off without me", pattern: /\bbetter off without me\b/i },
  { label: "no reason to live", pattern: /\bno (?:reason|point) (?:to|in) (?:live|living)\b/i },
  { label: "don't want to live", pattern: /\bdon'?t want to (?:live|be alive|wake up)\b/i },
  { label: "self-harm", pattern: /\bself[- ]?harm(?:ing)?\b/i },
  { label: "hurt myself", pattern: /\b(?:hurt|harm|cut)(?:ting)? my ?self\b/i },
  { label: "overdose", pattern: /\boverdos(?:e|ing)\b/i },

  /*
   * Sinhala (romanized) — same phrases as the chatbot safety check.
   */
  { label: "mata marenna ona", pattern: /\bmata marenna ona\b/i },
  { label: "mata maraganna ona", pattern: /\bmata maraganna ona\b/i },
  { label: "jeewithe epa", pattern: /\bj(?:ee|i)withe epa\b/i },
  { label: "mata mawa ridawaganna ona", pattern: /\bmata mawa ridawaganna ona\b/i },

  /*
   * Sinhala script. \b does not work with Sinhala characters,
   * so these are plain substring matches.
   */
  { label: "සියදිවි", pattern: /සියදිවි/ },
  { label: "මැරෙන්න ඕන", pattern: /මැරෙන්න\s*ඕන/ },
];

/**
 * Returns which crisis phrases (if any) appear in the text.
 *
 * @param {string} text
 * @returns {{ isCrisis: boolean, matchedTerms: string[] }}
 */
export const detectCrisisContent = (text) => {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { isCrisis: false, matchedTerms: [] };
  }

  const matchedTerms = [
    ...new Set(
      CRISIS_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
        ({ label }) => label
      )
    ),
  ];

  return {
    isCrisis: matchedTerms.length > 0,
    matchedTerms,
  };
};
