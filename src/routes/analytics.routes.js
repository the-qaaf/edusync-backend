import express from 'express';
import { getStats } from '../controllers/analytics.controller.js';

const router = express.Router();

router.get('/dashboard/stats', getStats);

export default router;
