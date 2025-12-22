
import * as emailService from '../services/email.service.js';
import * as whatsappService from '../services/whatsapp.service.js';

/**
 * Handle Batch Email Sending
 * Recommended for broadcasting to > 50 recipients.
 */
export const sendBatchEmail = async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid recipients list" });
    }

    console.log(`[Batch Controller] Starting email broadcast to ${to.length} recipients.`);

    // Offload to service (which handles chunking and pooling)
    const result = await emailService.sendBatchEmail(to, subject, text, html);

    res.status(200).json({
      success: true,
      message: "Batch processing completed",
      details: result
    });

  } catch (error) {
    console.error("Batch Email Controller Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Handle Batch WhatsApp Sending
 * Recommended for broadcasting to > 50 recipients.
 */
export const sendBatchWhatsApp = async (req, res) => {
  try {
    const { to, text, type, data } = req.body; // 'to' is array of objects { phone, ... } or strings

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid recipients list" });
    }

    if (!text) {
      return res.status(400).json({ success: false, error: "Missing message text" });
    }

    console.log(`[Batch Controller] Starting WhatsApp broadcast to ${to.length} recipients.`);

    // Normalize recipients for service
    // Service expects array of objects or strings, but best to be consistent.
    // If frontend sends full contact objects, we extract or pass through.

    let buttons = [];
    // Optional: Add logic here to generate dynamic buttons based on 'type' if you want backend to handle template logic reusing webhook logic.
    // For now, we assume simple text notifications.

    const result = await whatsappService.sendBatchWhatsAppMessage(to, text, buttons);

    res.status(200).json({
      success: true,
      message: "Batch processing completed",
      details: result
    });

  } catch (error) {
    console.error("Batch WhatsApp Controller Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
