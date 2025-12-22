
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import webhookRoutes from './routes/webhook.routes.js';
import emailRoutes from './routes/email.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', webhookRoutes);
app.use('/api', emailRoutes);
app.use('/api/whatsapp', whatsappRoutes);

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
