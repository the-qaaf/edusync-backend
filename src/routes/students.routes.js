import express from 'express';
import { getParentContacts, getStudents, addStudent, updateStudent, batchAddStudents } from '../controllers/students.controller.js';

const router = express.Router();

router.get('/contacts', getParentContacts);
router.get('/', getStudents);
router.post('/add', addStudent);
router.post('/batch', batchAddStudents);
router.put('/update', updateStudent);

export default router;

