
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
