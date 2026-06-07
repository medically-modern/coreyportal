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
import notesRoutes from './routes/notes.js';
import projectRoutes from './routes/projects.js';

// RAG — shared vector store with standalone Elena
import { initVectorStore, setupSchema } from './services/vectorStore.js';
import { warmup as warmupEmbeddings } from './services/embeddings.js';

config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    const allowed = /^https?:\/\/(medically-modern\.github\.io|localhost(:\d+)?)$/i;
    if (allowed.test(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(morgan('short'));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    rag: !!process.env.DATABASE_URL,
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
app.use('/api/notes', notesRoutes);
app.use('/api/projects', projectRoutes);

// Init DB and start
initDb();

// Init vector store (non-blocking — app works without it)
if (process.env.DATABASE_URL) {
  const connected = initVectorStore();
  if (connected) {
    setupSchema()
      .then(() => console.log('pgvector ready — shared knowledge base active'))
      .catch(err => console.error('pgvector setup failed:', err.message));
  }
  // Pre-warm embedding model in background
  warmupEmbeddings().catch(() => {});
} else {
  console.log('No DATABASE_URL — RAG disabled, hardcoded knowledge only');
}

app.listen(PORT, () => {
  console.log(`Corey Portal API running on :${PORT}`);
});
