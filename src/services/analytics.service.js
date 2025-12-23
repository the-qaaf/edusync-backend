import { db } from './firebase.service.js';
import { getOrFetch } from '../utils/cache.util.js';

/**
 * Fetch dashboard statistics (Counts + Recent Activity).
 */
export const getDashboardStats = async (schoolId) => {
  if (!schoolId) return null;
  const cacheKey = `dashboard:${schoolId}`;

  return getOrFetch(cacheKey, async () => {
    try {
      // 1. Total Students Count
      const studentsRef = db.collection('tenants').doc(schoolId).collection('students');
      const studentsSnap = await studentsRef.count().get();
      const totalStudents = studentsSnap.data().count;

      // 2. Total Updates Count
      const updatesRef = db.collection('tenants').doc(schoolId).collection('daily_updates');
      const updatesCountSnap = await updatesRef.count().get();
      const totalUpdates = updatesCountSnap.data().count;

      // 3. Total Broadcasts Count
      const broadcastsRef = db.collection('tenants').doc(schoolId).collection('broadcasts');
      const broadcastsCountSnap = await broadcastsRef.count().get();
      const totalBroadcasts = broadcastsCountSnap.data().count;

      // 4. Recent Activity (Updates + Broadcasts)
      const recentUpdatesSnap = await updatesRef.orderBy('date', 'desc').limit(5).get();
      const recentBroadcastsSnap = await broadcastsRef.orderBy('createdAt', 'desc').limit(5).get();

      // Process Updates
      const updateActivities = recentUpdatesSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: `Daily Update: ${data.subject || 'Subject'}`,
          description: `${data.teacherName || 'Teacher'} posted homework for Class ${data.classGrade}-${data.section}`,
          timestamp: data.date,
          type: "update",
        };
      });

      // Process Broadcasts
      const broadcastActivities = recentBroadcastsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.template === "custom" ? "Broadcast Announcement" : "Emergency Alert",
          description: `Sent to ${data.recipients || 0} recipients via ${data.channels?.join(" & ") || "System"}`,
          timestamp: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.date || new Date().toISOString()),
          type: "system",
        };
      });

      // Merge and Sort
      const recentActivity = [...updateActivities, ...broadcastActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

      return {
        totalStudents,
        totalUpdates,
        totalBroadcasts,
        recentActivity
      };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return { totalStudents: 0, totalUpdates: 0, recentActivity: [] };
    }
  }, 300);
};
