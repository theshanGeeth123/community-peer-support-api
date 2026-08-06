import crypto from "node:crypto";

export const generateSixDigitOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const hashToken = (value) => {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
};

export const securelyCompareToken = (plainValue, storedHash) => {
  if (!plainValue || !storedHash) {
    return false;
  }

  const generatedHash = hashToken(plainValue);

  const generatedHashBuffer = Buffer.from(generatedHash, "hex");
  const storedHashBuffer = Buffer.from(storedHash, "hex");

  if (generatedHashBuffer.length !== storedHashBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    generatedHashBuffer,
    storedHashBuffer
  );
};