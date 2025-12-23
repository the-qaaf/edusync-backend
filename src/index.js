
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import webhookRoutes from './routes/webhook.routes.js';
import emailRoutes from './routes/email.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import studentsRoutes from './routes/students.routes.js';

import broadcastRoutes from './routes/broadcast.routes.js';
import dailyUpdatesRoutes from './routes/daily-updates.routes.js';
import reportsRoutes from './routes/reports.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', webhookRoutes);
app.use('/api', emailRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api', analyticsRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/daily-updates', dailyUpdatesRoutes);
app.use('/api/reports', reportsRoutes);

// Health Check
app.get('/', (req, res) => {
  res.send('EduSync WhatsApp Server is running.');
});

// Start Server
if (process.env.NODE_ENV !== 'test') { // Allow testing via import
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
