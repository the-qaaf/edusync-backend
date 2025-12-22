
import { Router } from 'express';
import * as emailController from '../controllers/email.controller.js';

const router = Router();

router.post('/send-email', emailController.sendEmail);

export default router;
