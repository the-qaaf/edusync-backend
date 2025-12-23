import express from 'express';
import { saveReportCards, getReports, deleteReport } from '../controllers/reports.controller.js';

const router = express.Router();

router.post('/batch', saveReportCards);
router.get('/', getReports);
router.delete('/:reportId', deleteReport);

export default router;
