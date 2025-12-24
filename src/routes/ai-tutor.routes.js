
import express from 'express';
import { askAiTutor } from '../controllers/ai-tutor.controller.js';

const router = express.Router();

router.post('/ask', askAiTutor);

export default router;
