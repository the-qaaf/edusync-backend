
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

/**
 * Send Emails in Batches.
 * Optimized for broadcasting to many users separately (Personalized)
 * OR sending via BCC in chunks (Generic).
 * @param {Array<string>} recipients - List of email addresses
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 */
export const sendBatchEmail = async (recipients, subject, text, html) => {
  const CHUNK_SIZE = 50; // SMTP limits are usually stricter
  const DELAY_MS = 1000;

  const results = { success: 0, failed: 0, errors: [] };
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Reuse one transporter for all batches (Pooling)
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    secure: true,
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    pool: true, // Enable connection pooling
    maxConnections: 5,
    maxMessages: 100,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + CHUNK_SIZE);

    // Strategy: Send as ONE message with BCC for this chunk (Generic Broadcast)
    // This is much faster than sending 50 individual emails.
    // If you need personalization (Hi John), you must loop inside the chunk.

    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Send to self
        bcc: chunk, // BCC the 50 recipients
        subject,
        text,
        html
      };

      const info = await transporter.sendMail(mailOptions);
      results.success += chunk.length;
      console.log(`[Batch Email] Chunk ${i / CHUNK_SIZE + 1} sent: ${info.messageId}`);

    } catch (error) {
      console.error(`[Batch Email] Chunk failed:`, error);
      results.failed += chunk.length;
      results.errors.push(`Chunk starting at ${i} failed: ${error.message}`);
    }

    if (i + CHUNK_SIZE < recipients.length) {
      await wait(DELAY_MS);
    }
  }

  transporter.close(); // Clean up
  return results;
};
