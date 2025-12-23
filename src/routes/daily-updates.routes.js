import express from 'express';
import { getDailyUpdates, addDailyUpdate } from '../controllers/daily-updates.controller.js';

const router = express.Router();

router.get('/', getDailyUpdates);
router.post('/', addDailyUpdate);

export default router;
