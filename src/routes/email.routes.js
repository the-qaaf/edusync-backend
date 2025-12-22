
import { Router } from 'express';
import * as emailController from '../controllers/email.controller.js';
import * as batchController from '../controllers/batch.controller.js';

const router = Router();

router.post('/send-email', emailController.sendEmail);
router.post('/send-batch-email', batchController.sendBatchEmail);

export default router;
