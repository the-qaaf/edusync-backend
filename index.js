
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS for frontend integration
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QAAF Backend</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background-color: #0f172a;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        color: #e2e8f0;
      }
      .container {
        text-align: center;
        padding: 2rem;
        background: #1e293b;
        border-radius: 1rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border: 1px solid #334155;
      }
      h1 {
        margin-bottom: 0.5rem;
        color: #38bdf8;
      }
      p {
        color: #94a3b8;
      }
      .status {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background: #065f46;
        color: #34d399;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 1.5rem auto 0;
        width: fit-content;
      }
      .dot {
        width: 8px;
        height: 8px;
        background-color: #34d399;
        border-radius: 50%;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(52, 211, 153, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>QAAF Connect</h1>
      <p>Backend Services Operational</p>
      <div class="status">
        <div class="dot"></div>
        System Online
      </div>
    </div>
  </body>
  </html>
  `);
});

// --- WhatsApp Integration Configuration ---

const WA_API_URL = `https://graph.facebook.com/v18.0`;

/**
 * Template Registry
 * Centralized place to manage WhatsApp templates.
 *
 * Note: These template names (e.g., 'academic_alert', 'homework_update')
 * MUST be created and approved in the Meta Business Manager first.
 */
// Helper to send Text or Interactive Message (Fallback)
const sendWhatsAppTextMessage = async (to, text, options = []) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  let payload = {
    messaging_product: "whatsapp",
    to: to,
  };

  if (options.length > 0) {
    // Send as Interactive Button Message
    payload.type = "interactive";
    payload.interactive = {
      type: "button",
      body: { text: text },
      action: {
        buttons: options.map((opt, idx) => ({
          type: "reply",
          reply: {
            id: `btn_${idx}`,
            title: opt.label.substring(0, 20) // Max 20 chars for button title
          }
        }))
      }
    };
  } else {
    // Send as Standard Text
    payload.type = "text";
    payload.text = { body: text };
  }

  try {
    await axios.post(
      `${WA_API_URL}/${phoneId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    return { success: true, type: options.length > 0 ? "interactive_fallback" : "text_fallback" };
  } catch (error) {
    console.error("Fallback Failed:", error.response?.data || error.message);
    throw error;
  }
};

// --- Endpoints ---

/**
 * POST /api/whatsapp/notify
 * Sends a WhatsApp notification (Text or Interactive).
 *
 * Body: {
 *   to: "919876543210",
 *   type: "ACADEMIC_UPDATE",
 *   data: { studentName: "Aarav", updateMessage: "Math Homework Due", link: "ai-tutor" }
 * }
 */
// Helper to normalize recipients
const normalizeRecipients = (to) => {
  if (Array.isArray(to)) {
    return [...new Set(to.filter(Boolean))]; // Deduplicate and remove empty
  }
  return [to];
};

// Helper to send Template Message
const sendWhatsAppTemplateMessage = async (to, templateName, languageCode = "en_US", components = []) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components
    }
  };

  try {
    const response = await axios.post(
      `${WA_API_URL}/${phoneId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`Template sent to ${to} success:`, JSON.stringify(response.data));
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Template Send Failed:", error.response?.data || error.message);
    throw error;
  }
};

app.post('/api/whatsapp/notify', async (req, res) => {
  const { to, type, data } = req.body;

  if (!to || !type || !data) {
    return res.status(400).json({ error: "Missing required fields: to, type, data" });
  }

  const recipients = normalizeRecipients(to);
  const results = { success: [], failed: [] };

  // Helper to format phone numbers (default to India +91 if 10 digits)
  const formatPhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `91${cleaned}`;
    }
    return cleaned;
  };

  // Process all recipients
  await Promise.all(recipients.map(async (rawRecipient) => {
    const recipient = formatPhoneNumber(rawRecipient);
    try {
      // DEBUG: If type is specifically TEST_CONNECTION, send hello_world template
      if (type === "TEST_CONNECTION") {
        await sendWhatsAppTemplateMessage(recipient, "hello_world");
        results.success.push(recipient);
        return;
      }

      // Formatting logic for Direct Message (Text Fallback)
      let messageBody = "";
      if (type === "HOLIDAY_ALERT") {
        messageBody = `🏫 *${data.schoolName}*\n📅 Date: ${data.date}\n\n${data.reason}`;
      } else if (type === "BUS_DELAY") {
        messageBody = `🚌 *BUS DELAY ALERT*\nRoute: ${data.route}\nDelay: ${data.minutes}`;
      } else if (type === "EMERGENCY_ALERT") {
        messageBody = `🚨 *EMERGENCY*\n${data.message}`;
      } else if (data.updateMessage) {
        messageBody = `🏫 *${type.replace(/_/g, " ")}*\n\n${data.updateMessage}`;
      } else {
        // Generic fallback
        messageBody = `🏫 *${type.replace(/_/g, " ")}*\n\n${Object.values(data).join("\n")}`;
      }

      const fullBody = `🏫 *${type.replace(/_/g, " ")}*\n\n${messageBody}`;

      // Try sending text
      await sendWhatsAppTextMessage(recipient, fullBody);
      results.success.push(recipient);

    } catch (error) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error(`Failed to send WA to ${recipient}:`, errorMsg);
      results.failed.push({ recipient, error: errorMsg });
    }
  }));

  res.json({
    success: true,
    sentCount: results.success.length,
    failedCount: results.failed.length,
    details: results
  });
});

// --- Webhook Verification (GET) ---
app.get('/api/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Check if a verify token is set in .env
  const myVerifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'qaaf_token';

  if (mode && token) {
    if (mode === 'subscribe' && token === myVerifyToken) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// --- Webhook Incoming Messages (POST) ---
app.post('/api/webhook', async (req, res) => {
  const body = req.body;

  console.log('Webhook payload received:', JSON.stringify(req.body, null, 2));

  if (body.object) {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0]) {
      const value = body.entry[0].changes[0].value;

      // Handle Status Updates (Sent, Delivered, Read)
      if (value.statuses && value.statuses[0]) {
        const status = value.statuses[0];
        console.log(`[Status Update] ${status.status.toUpperCase()} for ${status.recipient_id}`);
      }

      // Handle Incoming Messages
      else if (value.messages && value.messages[0]) {
        const phone_number_id = value.metadata.phone_number_id;
        const from = value.messages[0].from;
        const msg_body = value.messages[0].text ? value.messages[0].text.body : '[Media/Other]';

        console.log(`[Incoming Message] From ${from}: ${msg_body}`);

        // Basic auto-reply logic (Handle for incoming message)
        try {
          const autoReplyText = `👋 *Hello from EduSync!*\n\nThank you for reaching out. We have received your message: _"${msg_body}"_\n\nA member of our team will assist you shortly.\n\n🏫 *Looking for Student Info?*\nVisit our Parent Portal for real-time updates:\n ${process.env.FRONTEND_URL}\n\n_This is an automated response._`;

          // Only reply if it's a text message to avoid loops with status updates (though status updates are handled above)
          if (value.messages[0].text) {
            await sendWhatsAppTextMessage(from, autoReplyText);
          }
        } catch (e) {
          console.error("Failed to send auto-reply");
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

/**
 * POST /api/send-email
 * Legacy email support
 */
app.post('/api/send-email', async (req, res) => {
  const { to, subject, text, html } = req.body;

  if (!to || !subject || !text) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const recipients = normalizeRecipients(to);

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

    const mailOptions = {
      from: process.env.EMAIL_USER,
      subject,
      text,
      html
    };

    if (recipients.length === 1) {
      mailOptions.to = recipients[0];
    } else {
      mailOptions.to = process.env.EMAIL_USER;
      mailOptions.bcc = recipients;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log('Message sent: %s', info.messageId);
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
