import { db } from './firebase.service.js';
import { getOrFetch } from '../utils/cache.util.js';

/**
 * Fetch homework for a specific class/section in a school.
 */
export const getHomework = async (schoolId, classGrade, section, date = null) => {
  if (!schoolId) return [];

  // Cache key includes date if strict filtering is requested
  const cacheKey = date
    ? `homework:${schoolId}:${classGrade}:${section}:${date}`
    : `homework:${schoolId}:${classGrade}:${section}:recent`;

  return getOrFetch(cacheKey, async () => {
    try {
      const updatesRef = db.collection('tenants').doc(schoolId).collection('daily_updates');

      let q = updatesRef
        .where('classGrade', '==', String(classGrade))
        .where('section', '==', String(section));

      // If we have a date, we can try to query by it, but date format might vary.
      // Easiest is to fetch limit(20) ordered by date and filter in memory.
      // Since it's daily updates, fetching last 20 is safe.

      q = q.orderBy('date', 'desc').limit(20);

      try {
        const snapshot = await q.get();
        const all = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));

        let filtered = all.filter(d => d.homework);

        if (date) {
          // Robust Date Comparison (YYYY-MM-DD)
          filtered = filtered.filter(d => {
            if (!d.date) return false;
            // Handle both full ISO and simple YYYY-MM-DD strings
            const recDate = new Date(d.date).toISOString().split('T')[0];
            return recDate === date;
          });
        }

        return filtered.slice(0, 5);

      } catch (e) {
        console.warn("Query failed (likely index), falling back to client-sort", e.message);
        const fallback = await updatesRef.limit(50).get();
        let docs = fallback.docs
          .map(d => d.data())
          .filter(d => d.classGrade === String(classGrade) && d.section === String(section) && d.homework);

        if (date) {
          docs = docs.filter(d => {
            if (!d.date) return false;
            const recDate = new Date(d.date).toISOString().split('T')[0];
            return recDate === date;
          });
        }

        return docs.sort((a, b) => b.date > a.date ? 1 : -1).slice(0, 5);
      }

    } catch (error) {
      console.error("Error fetching homework:", error);
      return [];
    }
  }, 300);
};
