
import nodemailer from 'nodemailer';

/**
 * Sends an email using Nodemailer.
 * @param {string|string[]} to - Recipient email(s)
 * @param {string} subject - Email subject
 * @param {string} text - Plain text body
 * @param {string} html - HTML body
 */
export const sendEmail = async (to, subject, text, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      secure: true,
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const toList = Array.isArray(to) ? to : [to];

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: toList.length === 1 ? toList[0] : process.env.EMAIL_USER,
      bcc: toList.length > 1 ? toList : undefined,
      subject,
      text,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email Error:', error);
    return { success: false, error: error.message };
  }
};
