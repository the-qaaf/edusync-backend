import { db } from './firebase.service.js';
import { getOrFetch } from '../utils/cache.util.js';

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
  }, 300);
};
