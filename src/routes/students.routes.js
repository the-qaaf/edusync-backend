import express from 'express';
import { getParentContacts, getStudents, addStudent, updateStudent, batchAddStudents, deleteStudent } from '../controllers/students.controller.js';

const router = express.Router();

router.get('/contacts', getParentContacts);
router.get('/', getStudents);
router.post('/add', addStudent);
router.post('/batch', batchAddStudents);
router.put('/update', updateStudent);
router.delete('/delete', deleteStudent);

export default router;

