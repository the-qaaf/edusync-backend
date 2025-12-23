import { db } from '../services/firebase.service.js';
import { invalidateCache } from '../utils/cache.util.js';

export const getDailyUpdates = async (req, res) => {
  try {
    const { schoolId, limit: limitQuery } = req.query;
    if (!schoolId) return res.status(400).json({ error: "Missing schoolId" });

    const limitCount = parseInt(limitQuery) || 20;

    const updatesRef = db.collection('tenants').doc(schoolId).collection('daily_updates');
    const q = updatesRef.orderBy('date', 'desc').limit(limitCount);
    const snapshot = await q.get();

    const updates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(updates);
  } catch (error) {
    console.error("Error fetching daily updates:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addDailyUpdate = async (req, res) => {
  try {
    const { schoolId } = req.query;
    const updateData = req.body;

    if (!schoolId) return res.status(400).json({ error: "Missing schoolId" });

    const payload = {
      ...updateData,
      createdAt: new Date()
    };

    const docRef = await db.collection('tenants').doc(schoolId).collection('daily_updates').add(payload);

    // Invalidate Caches
    await invalidateCache(`dashboard:${schoolId}`);
    if (updateData.classGrade && updateData.section) {
      await invalidateCache(`homework:${schoolId}:${updateData.classGrade}:${updateData.section}`);
    }

    res.status(201).json({ id: docRef.id });

  } catch (error) {
    console.error("Error adding daily update:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
