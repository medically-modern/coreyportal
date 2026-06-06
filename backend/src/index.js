import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';

import { initDb } from './db/init.js';
import gmailRoutes from './routes/gmail.js';
import slackRoutes from './routes/slack.js';
import rcRoutes from './routes/ringcentral.js';
import qaRoutes from './routes/qa.js';
import mondayRoutes from './routes/monday.js';
import assistantRoutes from './routes/assistant.js';
import dashboardRoutes from './routes/dashboard.js';
import contextRoutes from './routes/context.js';
import ingestRoutes from './routes/ingest.js';

config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || /^https?:\/\/(medically-modern\.github\.io|localhost(:\d+)?)/i,
  credentials: true,
}));
app.use(morgan('short'));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      gmail: !!process.env.GOOGLE_CLIENT_ID,
      slack: !!process.env.SLACK_BOT_TOKEN,
      ringcentral: !!process.env.RC_CLIENT_ID,
      monday: !!process.env.MONDAY_API_TOKEN,
      claude: !!process.env.ANTHROPIC_API_KEY,
    },
  });
});

// Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/ringcentral', rcRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/monday', mondayRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/context', contextRoutes);
app.use('/api/elena', ingestRoutes);

// Init DB and start
initDb();
app.listen(PORT, () => {
  console.log(`Corey Portal API running on :${PORT}`);
});
