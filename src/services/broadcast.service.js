import { db } from './firebase.service.js';
import { getOrFetch } from '../utils/cache.util.js';

/**
 * Fetch announcements (broadcasts) for the school.
 */
export const getAnnouncements = async (schoolId, date = null) => {
  if (!schoolId) return [];

  const cacheKey = date
    ? `announcements:${schoolId}:${date}`
    : `announcements:${schoolId}:recent`;

  return getOrFetch(cacheKey, async () => {
    try {
      const broadcastsRef = db.collection('tenants').doc(schoolId).collection('broadcasts');

      const q = broadcastsRef.orderBy('createdAt', 'desc').limit(20);
      const snap = await q.get();

      let all = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));

      if (date) {
        all = all.filter(d => {
          const recDateStr = d.date || (d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : null);
          if (!recDateStr) return false;
          // Normalize to YYYY-MM-DD
          const recDate = new Date(recDateStr).toISOString().split('T')[0];
          return recDate === date;
        });
      }

      return all.slice(0, 5); // Return top 5 matching
    } catch (error) {
      console.error("Error fetching announcements:", error);
      return [];
    }
  }, 300);
};
