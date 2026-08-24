export const REPORT_STATUS = Object.freeze({
  PENDING: "PENDING",
  REVIEWED: "REVIEWED",
});

export const REPORT_REASON = Object.freeze({
  HARMFUL_CONTENT: "HARMFUL_CONTENT",
  HATE_SPEECH: "HATE_SPEECH",
  SPAM: "SPAM",
  MISINFORMATION: "MISINFORMATION",
  OTHER: "OTHER",
});

export const MODERATION_ACTION_TYPE = Object.freeze({
  NO_ACTION: "NO_ACTION",
  WARN: "WARN",
  REMOVE: "REMOVE",
});

export const REPORT_TARGET_TYPE = Object.freeze({
  POST: "POST",
  COMMENT: "COMMENT",
});
