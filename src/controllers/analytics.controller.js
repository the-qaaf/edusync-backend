import { getDashboardStats } from '../services/analytics.service.js';

export const getStats = async (req, res) => {
  try {
    const { schoolId } = req.query;

    if (!schoolId) {
      return res.status(400).json({ error: 'Missing schoolId parameter' });
    }

    const stats = await getDashboardStats(schoolId);

    // Fallback if stats is null for some reason
    if (!stats) {
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error in getStats controller:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
