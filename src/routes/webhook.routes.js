
import { Router } from 'express';
import * as webhookController from '../controllers/webhook.controller.js';

const router = Router();

// Verification for WhatsApp
router.get('/webhook', webhookController.verifyWebhook);

// Handling incoming messages
router.post('/webhook', webhookController.handleIncomingMessage);

export default router;
