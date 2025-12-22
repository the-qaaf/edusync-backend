
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
import { getPhoneVariations } from '../utils/phone.util.js';

dotenv.config();

// Initialize Cache (TTL: 300s / 5 mins by default)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

// Initialize Firebase
if (!admin.apps.length) {
  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } else {
      credential = admin.credential.applicationDefault();
    }

    admin.initializeApp({ credential });
    console.log('Firebase Admin Service Initialized');
  } catch (error) {
    console.error('Firebase Init Error:', error.message);
  }
}

const db = admin.firestore();

/**
 * Returns a cached value or executes the fetcher function and caches the result.
 */
const getOrFetch = async (key, fetcher, ttl = 300) => {
  const cached = cache.get(key);
  if (cached) {
    console.log(`[CACHE HIT] ${key}`);
    return cached;
  }
  console.log(`[CACHE MISS] ${key}`);
  const result = await fetcher();
  cache.set(key, result, ttl);
  return result;
};

/**
 * Find ALL students linked to a phone number.
 * Strategy: Parallel Global Collection Group Queries.
 * Scalability: This is O(1) relative to the number of schools. It runs a fixed number of queries (2-4) regardless of whether you have 10 or 10,000 schools.
 * Requirement: Firebase "Collection Group" Index enabled for 'parentPhone' and 'alternateParentPhone' (Single field).
 * @param {string} phone
 */
export const findStudentsByPhone = async (phone) => {
  const cacheKey = `students:${phone}`;

  return getOrFetch(cacheKey, async () => {
    try {
      const variations = getPhoneVariations(phone);
      console.log(`[Lookup] Searching globally for variants: ${variations.join(', ')}`);

      const studentsRef = db.collectionGroup('students');

      // Create a specific query for each variation and each field.
      // This is more robust than Filter.or() and uses standard single-field indexes.
      const queries = [];
      variations.forEach(v => {
        queries.push(studentsRef.where('parentPhone', '==', v).get());
        queries.push(studentsRef.where('alternateParentPhone', '==', v).get());
      });

      // Execute all globally optimized queries in parallel
      const results = await Promise.allSettled(queries);
      const foundStudents = new Map();
      const studentPromises = [];

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          result.value.forEach(doc => {
            // Defer processing to handle async school fetch
            studentPromises.push(async () => {
              if (foundStudents.has(doc.id)) return;

              const data = doc.data();
              const schoolId = doc.ref.parent.parent?.id; // Parent of 'students' collection is 'schoolId' doc

              if (schoolId) {
                // Fetch School Name from Settings
                let schoolName = "School";
                try {
                  const settingsDoc = await db.collection('tenants')
                    .doc(schoolId)
                    .collection('settings')
                    .doc('general')
                    .get();

                  if (settingsDoc.exists) {
                    schoolName = settingsDoc.data().schoolName || "School";
                  }
                } catch (e) { console.warn('Failed to fetch school name', e); }

                let parentName = data.parentName || "Parent";
                if (data.fatherName) parentName = data.fatherName;
                else if (data.motherName) parentName = data.motherName;

                foundStudents.set(doc.id, {
                  studentId: doc.id,
                  schoolId: schoolId,
                  schoolName: schoolName,
                  parentName: parentName,
                  studentName: data.name || "Student",
                  classGrade: data.class || data.classGrade,
                  section: data.section
                });
              }
            });
          });
        }
        else {
          if (String(result.reason).includes("requires an index")) {
            console.error("\n⚡️ ACTION REQUIRED: Create Firebase Index.");
            const match = String(result.reason).match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
            if (match) console.error("👉 LINK: " + match[0] + "\n");
          }
        }
      });

      // Execute all detail fetches
      await Promise.all(studentPromises.map(fn => fn()));

      const params = Array.from(foundStudents.values());
      console.log(`[Lookup] Found ${params.length} students.`);
      return params;

    } catch (error) {
      console.error("Unexpected error in findStudentsByPhone:", error);
      return [];
    }
  }, 600);
};


/**
 * Fetch homework for a specific class/section in a school.
 */
export const getHomework = async (schoolId, classGrade, section) => {
  if (!schoolId) return [];
  const cacheKey = `homework:${schoolId}:${classGrade}:${section}`;

  return getOrFetch(cacheKey, async () => {
    try {
      const updatesRef = db.collection('tenants').doc(schoolId).collection('daily_updates');

      let q = updatesRef
        .where('classGrade', '==', String(classGrade))
        .where('section', '==', String(section))
        .orderBy('date', 'desc')
        .limit(20);

      try {
        const snapshot = await q.get();
        const all = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));

        return all
          .filter(d => d.homework)
          .slice(0, 5);

      } catch (e) {
        console.warn("Query failed (likely index), falling back to client-sort", e.message);
        const fallback = await updatesRef.limit(20).get();
        return fallback.docs
          .map(d => d.data())
          .filter(d => d.classGrade === String(classGrade) && d.section === String(section) && d.homework)
          .sort((a, b) => b.date > a.date ? 1 : -1)
          .slice(0, 5);
      }

    } catch (error) {
      console.error("Error fetching homework:", error);
      return [];
    }
  }, 300); // Cache for 5 mins
};

/**
 * Fetch announcements (broadcasts) for the school.
 */
export const getAnnouncements = async (schoolId) => {
  if (!schoolId) return [];
  const cacheKey = `announcements:${schoolId}`;

  return getOrFetch(cacheKey, async () => {
    try {
      const broadcastsRef = db.collection('tenants').doc(schoolId).collection('broadcasts');

      const q = broadcastsRef.orderBy('createdAt', 'desc').limit(3);
      const snap = await q.get();

      return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (error) {
      console.error("Error fetching announcements:", error);
      return [];
    }
  }, 300);
};
