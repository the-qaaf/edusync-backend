
import axios from 'axios';

const WA_API_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v24.0'}`;

/**
 * Sends a message via WhatsApp Cloud API.
 * @param {string} to - Recipient phone number
 * @param {string} text - Message body
 * @param {Array<{id: string, label: string, type?: string, url?: string}>} [buttons] - Optional buttons (Reply or URL)
 */
export const sendWhatsAppMessage = async (to, text, buttons = []) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.error("Missing WhatsApp credentials in environment");
    return { success: false, error: "Missing Credentials" };
  }

  const payload = {
    messaging_product: "whatsapp",
    to: to,
  };

  if (buttons && buttons.length > 0) {
    // Check if we have a URL button (CTA)
    // Note: WhatsApp API (v16+) supports 'cta_url' interactive messages.
    // Limitation: Cannot mix 'cta_url' with 'reply' buttons in the same message.
    const urlButton = buttons.find(b => b.type === 'url' || b.url);

    if (urlButton) {
      payload.type = "interactive";
      payload.interactive = {
        type: "cta_url",
        body: { text: text },
        action: {
          name: "cta_url",
          parameters: {
            display_text: urlButton.label || "Open Link",
            url: urlButton.url
          }
        }
      };
    } else {
      // Standard Reply Buttons
      payload.type = "interactive";
      payload.interactive = {
        type: "button",
        body: { text: text },
        action: {
          buttons: buttons.map((btn) => ({
            type: "reply",
            reply: {
              id: btn.id,
              title: btn.label.substring(0, 20)
            }
          }))
        }
      };
    }
  } else {
    payload.type = "text";
    payload.text = { body: text };
  }

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
    return { success: true, data: response.data };
  } catch (error) {
    const msg = error.response?.data || error.message;
    console.error("WhatsApp Send Log:", JSON.stringify(msg, null, 2));
    return { success: false, error: msg };
  }
};

/**
 * Sends a TEMPLATE message via WhatsApp Cloud API (Utility/Marketing).
 * @param {string} to - Recipient phone number
 * @param {string} templateName - Name of the template in Meta Business Manager
 * @param {string} languageCode - Language code (e.g., 'en_US')
 * @param {Array} components - Template variable components (header, body, buttons)
 */
export const sendTemplateMessage = async (to, templateName, languageCode = "en_US", components = []) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  console.log("🚀 ~ sendTemplateMessage ~ token:", token)
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  console.log("🚀 ~ sendTemplateMessage ~ phoneId:", phoneId)

  if (!token || !phoneId) {
    return { success: false, error: "Missing WhatsApp Credentials" };
  }

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode === 'en' ? 'en_US' : (languageCode || "en_US") },
      components: components,
    }
  };
  console.log("🚀 ~ sendTemplateMessage ~ payload:", payload)

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
    return { success: true, data: response.data };
  } catch (error) {
    const msg = error.response?.data || error.message;
    console.error("WhatsApp Template Send Log:", JSON.stringify(msg, null, 2));
    return { success: false, error: msg };
  }
};

/**
 * Send WhatsApp messages in batches (Text or Template).
 * @param {Array} recipients - Array of strings (phones) or objects { phone, params, components }
 * @param {Object} options - { text, buttons, templateName, language, components }
 */
export const sendBatchWhatsAppMessage = async (recipients, options = {}) => {
  const CHUNK_SIZE = 50;
  const DELAY_MS = 1000;

  const results = { success: 0, failed: 0, errors: [] };
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + CHUNK_SIZE);

    const promises = chunk.map(async (r) => {
      try {
        const phone = typeof r === 'string' ? r : r.phone;
        let res;

        // Determine if Template or Text
        if (options.templateName) {
          // Allow per-recipient component overrides (e.g. name variables)
          const components = (typeof r === 'object' && r.components) ? r.components : (options.components || []);
          res = await sendTemplateMessage(phone, options.templateName, options.language, components);
        } else {
          // Fallback to Text
          const message = (typeof r === 'object' && r.text) ? r.text : options.text;
          res = await sendWhatsAppMessage(phone, message, options.buttons);
        }

        if (res.success) results.success++;
        else {
          results.failed++;
          results.errors.push({ phone: phone, error: res.error });
        }
      } catch (e) {
        results.failed++;
        try {
          const phone = typeof r === 'string' ? r : r?.phone || 'unknown';
          results.errors.push({ phone: phone, error: e.message });
        } catch (e2) { }
      }
    });

    await Promise.all(promises);

    if (i + CHUNK_SIZE < recipients.length) {
      await wait(DELAY_MS);
    }
  }

  return results;
};

/**
 * Mark a message as read (Blue Ticks).
 */
export const markMessageAsRead = async (messageId) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;

  try {
    await axios.post(
      `${WA_API_URL}/${phoneId}/messages`,
      { messaging_product: "whatsapp", status: "read", message_id: messageId },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );
  } catch (e) { console.error("Failed to mark read", e.message); }
};
