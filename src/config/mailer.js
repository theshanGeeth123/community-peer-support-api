import nodemailer from "nodemailer";

const requiredEmailVariables = ["EMAIL_USER", "EMAIL_PASS"];

for (const variableName of requiredEmailVariables) {
  if (!process.env[variableName]) {
    throw new Error(
      `Missing required email environment variable: ${variableName}`
    );
  }
}

const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default mailTransporter;