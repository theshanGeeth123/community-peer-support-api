import crypto from "node:crypto";

export const generateSixDigitOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const hashToken = (value) => {
  return crypto.createHash("sha256").update(value).digest("hex");
};