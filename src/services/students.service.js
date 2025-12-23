import { db } from './firebase.service.js'; // Import db from centralized firebase service or common module
// But since we are refactoring, we might want to expose db from firebase.service.js OR have a common db.js.
// Current firebase.service.js initializes admin.
// We should modify firebase.service.js to ONLY initialize admin and export db/getOrFetch.

import { getOrFetch } from '../utils/cache.util.js'; // We'll move getOrFetch to util
import { getPhoneVariations } from '../utils/phone.util.js';

/**
 * Get cached school name to avoid repeated reads.
 * TTL: 24 Hours (School names rarely change)
 */
const getSchoolName = async (schoolId) => {
  return getOrFetch(`school_name:${schoolId}`, async () => {
    try {
      const settingsDoc = await db.collection('tenants')
        .doc(schoolId)
        .collection('settings')
        .doc('general')
        .get();

      if (settingsDoc.exists) {
        return settingsDoc.data().schoolName || "School";
      }
      return "School";
    } catch (e) {
      console.warn(`Failed to fetch school name for ${schoolId}`, e);
      return "School";
    }
  }, 86400);
};

/**
 * Find ALL students linked to a phone number.
 */
export const findStudentsByPhone = async (phone) => {
  const cacheKey = `students:${phone}`;

  return getOrFetch(cacheKey, async () => {
    try {
      const variations = getPhoneVariations(phone);
      console.log(`[Lookup] Searching globally for variants: ${variations.join(', ')}`);

      const studentsRef = db.collectionGroup('students');

      const queries = [];
      variations.forEach(v => {
        queries.push(studentsRef.where('parentPhone', '==', v).get());
        queries.push(studentsRef.where('alternateParentPhone', '==', v).get());
      });

      const results = await Promise.allSettled(queries);
      const foundStudents = new Map();
      const studentPromises = [];

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          result.value.forEach(doc => {
            studentPromises.push(async () => {
              if (foundStudents.has(doc.id)) return;

              const data = doc.data();
              const schoolId = doc.ref.parent.parent?.id;

              if (schoolId) {
                // Optimized: Use Cached School Name
                const schoolName = await getSchoolName(schoolId);

                let parentName = data.parentName || "Parent";
                if (data.fatherName) parentName = data.fatherName;
                else if (data.motherName) parentName = data.motherName;

                foundStudents.set(doc.id, {
                  studentId: doc.id,
                  schoolId: schoolId,
                  schoolName: schoolName, // Uses cache
                  parentName: parentName,
                  studentName: data.name || "Student",
                  classGrade: data.class || data.classGrade,
                  section: data.section
                });
              }
            });
          });
        }
      });

      await Promise.all(studentPromises.map(fn => fn()));
      return Array.from(foundStudents.values());

    } catch (error) {
      console.error("Unexpected error in findStudentsByPhone:", error);
      return [];
    }
  }, 600);
};

/**
 * Fetch all parent contacts for a school (Optimized for Broadcasts).
 */
export const getAllParentContacts = async (schoolId) => {
  if (!schoolId) return [];
  const cacheKey = `parent_contacts:${schoolId}`;

  return getOrFetch(cacheKey, async () => {
    try {
      const studentsRef = db.collection('tenants').doc(schoolId).collection('students');
      const snapshot = await studentsRef.select('parentEmail', 'parentPhone', 'alternateParentPhone', 'fatherName', 'motherName', 'name', 'class', 'section').get();

      return snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            email: data.parentEmail || "",
            phone: data.parentPhone || "",
            alternatePhone: data.alternateParentPhone || "",
            name: data.fatherName || data.motherName || "Parent",
            studentId: doc.id,
            studentName: data.name,
            class: data.class,
            section: data.section,
          };
        })
        .filter(c => c.email || c.phone);
    } catch (error) {
      console.error("Error fetching parent contacts:", error);
      return [];
    }
  }, 3600);
};
