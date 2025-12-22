
import * as emailService from '../services/email.service.js';

export const sendEmail = async (req, res) => {
  const { to, subject, text, html } = req.body;

  if (!to || !subject || !text) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const result = await emailService.sendEmail(to, subject, text, html);

  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
};
