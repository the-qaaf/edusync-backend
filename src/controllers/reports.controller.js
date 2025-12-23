import { db } from '../services/firebase.service.js';

export const saveReportCards = async (req, res) => {
  try {
    const { schoolId } = req.query;
    const { reports } = req.body; // Expecting an array of reports

    if (!schoolId) return res.status(400).json({ error: "Missing schoolId" });
    if (!Array.isArray(reports) || reports.length === 0) return res.status(400).json({ error: "No reports provided" });

    const batch = db.batch();
    const reportsRef = db.collection('tenants').doc(schoolId).collection('reports');

    reports.forEach(report => {
      // Optional: Recalculate grades here for integrity if needed
      const docRef = reportsRef.doc();
      batch.set(docRef, {
        ...report,
        createdAt: new Date()
      });
    });

    await batch.commit();
    res.status(200).json({ message: "Reports saved successfully" });

  } catch (error) {
    console.error("Error saving reports:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getReports = async (req, res) => {
  try {
    const { schoolId, className, section, term, limit: limitQuery } = req.query;

    if (!schoolId) return res.status(400).json({ error: "Missing schoolId" });

    // Basic filtering
    let q = db.collection('tenants').doc(schoolId).collection('reports');

    if (className) q = q.where('class', '==', className);
    if (section) q = q.where('section', '==', section);
    if (term) q = q.where('term', '==', term);

    q = q.orderBy('createdAt', 'desc').limit(parseInt(limitQuery) || 20);

    const snapshot = await q.get();
    const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.status(200).json({ reports });

  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteReport = async (req, res) => {
  try {
    const { schoolId } = req.query;
    const { reportId } = req.params;
    if (!schoolId || !reportId) return res.status(400).json({ error: "Missing parameters" });

    await db.collection('tenants').doc(schoolId).collection('reports').doc(reportId).delete();
    res.status(200).json({ message: "Report deleted" });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
