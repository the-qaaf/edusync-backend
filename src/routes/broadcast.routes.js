import express from 'express';
import { getBroadcastHistory, createBroadcast } from '../controllers/broadcast.controller.js';

const router = express.Router();

router.get('/history', getBroadcastHistory);
router.post('/create', createBroadcast);

export default router;
