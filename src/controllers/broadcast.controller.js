import { db } from '../services/firebase.service.js';
import { invalidateCache } from '../utils/cache.util.js';

export const getBroadcastHistory = async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: "Missing schoolId" });

    const limitCount = parseInt(req.query.limit) || 20;

    const broadcastsRef = db.collection('tenants').doc(schoolId).collection('broadcasts');
    const q = broadcastsRef.orderBy('createdAt', 'desc').limit(limitCount);
    const snapshot = await q.get();

    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(logs);
  } catch (error) {
    console.error("Error fetching broadcasts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createBroadcast = async (req, res) => {
  try {
    const { schoolId } = req.query; // Or req.body
    const { message, channels, template, recipientsCount, status } = req.body;

    if (!schoolId) return res.status(400).json({ error: "Missing schoolId" });

    const payload = {
      message,
      channels,
      template: template || "custom",
      recipients: recipientsCount || 0,
      status: status || "Pending",
      date: new Date().toISOString(),
      createdAt: new Date(), // Admin SDK uses Date objects or Timestamp
    };

    const docRef = await db.collection('tenants').doc(schoolId).collection('broadcasts').add(payload);

    // Invalidate Caches
    await invalidateCache(`dashboard:${schoolId}`);
    await invalidateCache(`announcements:${schoolId}`);

    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error("Error creating broadcast:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
