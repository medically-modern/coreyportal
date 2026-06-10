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
import trashRoutes from './routes/trash.js';

// RAG + Rules loaded dynamically — app works without them
let initVectorStore, setupSchema, warmupEmbeddings, initRulesPool, setupRulesSchema, rulesRoutes;

config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
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
app.use('/api/trash', trashRoutes);
// Init DB and start
initDb();

// Init RAG + Rules + Conversations dynamically (non-blocking — app works without them)
(async () => {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL — RAG + rules + persistent conversations disabled');
    return;
  }
  try {
    const vs = await import('./services/vectorStore.js');
    const emb = await import('./services/embeddings.js');
    initVectorStore = vs.initVectorStore;
    setupSchema = vs.setupSchema;
    warmupEmbeddings = emb.warmup;

    const connected = initVectorStore();
    if (connected) {
      await setupSchema().catch(err => console.error('pgvector setup failed:', err.message));
      console.log('pgvector ready — shared knowledge base active');
    }
    warmupEmbeddings().catch(() => {});
  } catch (err) {
    console.warn('RAG modules not available:', err.message);
  }
  try {
    const rules = await import('./services/rules.js');
    initRulesPool = rules.initRulesPool;
    setupRulesSchema = rules.setupRulesSchema;
    const rulesConnected = initRulesPool();
    if (rulesConnected) {
      await setupRulesSchema().catch(err => console.error('Rules schema setup failed:', err.message));
      console.log('Rules engine ready — shared rules active');
    }
    const rr = await import('./routes/rules.js');
    rulesRoutes = rr.default;
    app.use('/api/rules', rulesRoutes);
  } catch (err) {
    console.warn('Rules module not available:', err.message);
  }
  // Persistent conversations — shared Postgres
  try {
    const pgConvos = await import('./services/pgConversations.js');
    const convosConnected = pgConvos.initConversationsPool();
    if (convosConnected) {
      await pgConvos.setupConversationsSchema().catch(err => console.error('Conversations schema setup failed:', err.message));
      await pgConvos.ensurePortalConversation().catch(() => {});
      console.log('Postgres conversations ready — portal history persists across deploys');
    }
  } catch (err) {
    console.warn('pgConversations not available:', err.message);
  }
})();

app.listen(PORT, () => {
  console.log(`Corey Portal API running on :${PORT}`);
});
