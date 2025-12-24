import { db } from '../services/firebase.service.js';
import { getAllParentContacts } from '../services/students.service.js';
import { invalidateCache } from '../utils/cache.util.js';

export const getParentContacts = async (req, res) => {
  try {
    const { schoolId } = req.query;

    if (!schoolId) {
      return res.status(400).json({ error: 'Missing schoolId parameter' });
    }

    const contacts = await getAllParentContacts(schoolId);

    res.status(200).json({
      count: contacts.length,
      contacts: contacts
    });
  } catch (error) {
    console.error('Error in getParentContacts controller:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getStudents = async (req, res) => {
  try {
    const { schoolId, classGrade, section, search, limit: limitQuery } = req.query;
    if (!schoolId) return res.status(400).json({ error: "Missing schoolId" });

    let studentsRef = db.collection('tenants').doc(schoolId).collection('students');
    let q = studentsRef;

    if (classGrade) q = q.where('class', '==', `Class ${classGrade}`);
    if (section) q = q.where('section', '==', section);

    // Search logic in Firestore is limited to prefix match usually
    // For advanced search, we might need Algolia or simple client-side filtering after fetch if small.
    // Implementing basic ordering for pagination
    q = q.orderBy('name').limit(parseInt(limitQuery) || 20);

    const snapshot = await q.get();
    let students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Manual search if filter exists (since Firestore 'where' + 'orderBy' can be strict)
    if (search) {
      const s = search.toLowerCase();
      students = students.filter(st => st.name.toLowerCase().includes(s));
    }

    res.status(200).json({ students, totalCount: students.length });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addStudent = async (req, res) => {
  try {
    const { schoolId } = req.query;
    const student = req.body;
    if (!schoolId) return res.status(400).json({ error: "Missing schoolId" });

    const docRef = await db.collection('tenants').doc(schoolId).collection('students').add(student);

    // Invalidate Caches
    await invalidateCache(`parent_contacts:${schoolId}`);
    await invalidateCache(`dashboard:${schoolId}`); // Count changed

    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error("Error adding student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { schoolId, studentId } = req.query;
    const data = req.body;
    if (!schoolId || !studentId) return res.status(400).json({ error: "Missing schoolId or studentId" });

    await db.collection('tenants').doc(schoolId).collection('students').doc(studentId).update(data);

    // Invalidate Caches
    // We don't know if phone changed, safe to invalidate contacts.
    await invalidateCache(`parent_contacts:${schoolId}`);
    // If we cached individual student by phone, we should invalidate that too?
    // The key is `students:${phone}`. Since we don't know the OLD phone easily without a read,
    // we might have stale data for that specific phone lookup for 5 mins.
    // This is acceptable trade-off for now. Or we could read before update if critical.
    if (data.parentPhone) await invalidateCache(`students:${data.parentPhone}`);

    res.status(200).json({ message: "Student updated" });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export const batchAddStudents = async (req, res) => {
  try {
    const { schoolId } = req.query;
    const { students } = req.body; // Expect array
    if (!schoolId) return res.status(400).json({ error: "Missing schoolId" });
    if (!Array.isArray(students)) return res.status(400).json({ error: "Invalid students array" });

    const batch = db.batch();
    const studentsRef = db.collection('tenants').doc(schoolId).collection('students');

    let count = 0;
    // Firestore batch limit is 500
    // We only handle first 500 for now or chunks if needed,
    // but simplest is to assume caller chunks or we handle single batch here.
    // For robustness, let's just do first 500.

    students.slice(0, 500).forEach(student => {
      const docRef = studentsRef.doc();
      batch.set(docRef, student);
      count++;
    });

    await batch.commit();

    // Invalidate Caches
    await invalidateCache(`parent_contacts:${schoolId}`);
    await invalidateCache(`dashboard:${schoolId}`);

    res.status(201).json({ message: `Added ${count} students` });
  } catch (error) {
    console.error("Error batch adding students:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
