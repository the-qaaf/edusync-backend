import { db } from './firebase.service.js';
import { getOrFetch } from '../utils/cache.util.js';

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
