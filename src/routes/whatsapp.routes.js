
import { Router } from 'express';
import * as batchController from '../controllers/batch.controller.js';

const router = Router();

// Outbound WhatsApp Routes
router.post('/batch-notify', batchController.sendBatchWhatsApp);

export default router;
