const CRISIS_PATTERNS = [
  /\bkill myself\b/i,
  /\bend my life\b/i,
  /\bwant to die\b/i,
  /\bi want to die\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bself[- ]?harm\b/i,
  /\bhurt myself\b/i,
  /\bharm myself\b/i,
  /\bkill someone\b/i,
  /\bhurt someone\b/i,
  /\bharm someone\b/i,
  /\bimmediate danger\b/i,

  /*
   * Common Sinhala transliteration examples.
   * This is only a simple first-line safety check.
   */
  /\bmata marenna ona\b/i,
  /\bmata maraganna ona\b/i,
  /\bmata jeewithe epa\b/i,
  /\bmata jiwithe epa\b/i,
  /\bjeewithe epa\b/i,
  /\bjiwithe epa\b/i,
  /\bmata mawa ridawaganna ona\b/i,
];

export const isPotentialCrisisMessage = (
  message
) => {
  if (
    typeof message !== "string"
  ) {
    return false;
  }

  return CRISIS_PATTERNS.some(
    (pattern) =>
      pattern.test(message)
  );
};

export const getCrisisSupportResponse =
  () => {
    return [
      "I'm concerned that this may be an immediate safety situation.",
      "Please seek immediate human help now by contacting local emergency services or an available crisis service.",
      "If possible, contact a trusted person who can stay with you and move to a safer place.",
      "This chatbot is not an emergency or medical service.",
    ].join(" ");
  };