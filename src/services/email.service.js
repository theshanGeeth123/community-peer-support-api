import mailTransporter from "../config/mailer.js";

export const sendEmailVerificationOtp = async ({
  recipientEmail,
  recipientName,
  otp,
  expiresInMinutes,
}) => {
  const applicationName =
    process.env.EMAIL_FROM_NAME || "Community Peer Support";

  const safeRecipientName = recipientName || "User";

  const mailOptions = {
    from: {
      name: applicationName,
      address: process.env.EMAIL_USER,
    },

    to: recipientEmail,

    subject: `Verify your ${applicationName} account`,

    text: [
      `Hello ${safeRecipientName},`,
      "",
      `Your email verification code is: ${otp}`,
      "",
      `This code expires in ${expiresInMinutes} minutes.`,
      "",
      "Do not share this code with anyone.",
      "",
      `Regards,`,
      `${applicationName}`,
    ].join("\n"),

    html: `
      <div
        style="
          max-width: 560px;
          margin: 0 auto;
          padding: 32px;
          font-family: Arial, Helvetica, sans-serif;
          color: #1f2937;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        "
      >
        <h2 style="margin-top: 0;">
          Email Verification
        </h2>

        <p>Hello ${safeRecipientName},</p>

        <p>
          Use the following verification code to complete your
          ${applicationName} registration:
        </p>

        <div
          style="
            margin: 24px 0;
            padding: 18px;
            text-align: center;
            background: #f3f4f6;
            border-radius: 8px;
            font-size: 30px;
            font-weight: bold;
            letter-spacing: 8px;
          "
        >
          ${otp}
        </div>

        <p>
          This code expires in
          <strong>${expiresInMinutes} minutes</strong>.
        </p>

        <p>
          Do not share this code with anyone. Our staff will never ask
          you to provide this verification code.
        </p>

        <p style="margin-bottom: 0;">
          Regards,<br />
          <strong>${applicationName}</strong>
        </p>
      </div>
    `,
  };

  return mailTransporter.sendMail(mailOptions);
};