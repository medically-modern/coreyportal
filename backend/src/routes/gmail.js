import { Router } from 'express';
import { summarize, triageItems } from '../services/claude.js';
import { getAuthUrl, handleCallback, checkConnection, getThreads, getThread, markAsRead, getUnreadCount, searchEmails } from '../services/gmail.js';

const router = Router();

// OAuth flow
router.get('/auth', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

router.get('/oauth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'No auth code provided' });
    await handleCallback(code);
    // Redirect to frontend after successful auth
    const frontendUrl = process.env.FRONTEND_URL || 'https://medically-modern.github.io/coreyportal';
    res.redirect(`${frontendUrl}/#/gmail?connected=true`);
  } catch (err) {
    res.status(500).json({ error: 'OAuth failed', details: err.message });
  }
});

// Connection status
router.get('/status', async (req, res) => {
  try {
    const status = await checkConnection();
    res.json(status);
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// Inbox threads
router.get('/threads', async (req, res) => {
  try {
    const { max = 20, q = '' } = req.query;
    const threads = await getThreads({ maxResults: parseInt(max), q });
    res.json({ threads });
  } catch (err) {
    if (err.message.includes('not authorized')) {
      return res.status(401).json({ error: err.message, authUrl: getAuthUrl() });
    }
    res.status(500).json({ error: err.message });
  }
});

// Single thread
router.get('/thread/:id', async (req, res) => {
  try {
    const thread = await getThread(req.params.id);
    res.json({ thread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Summarize a thread with Claude
router.get('/summarize/:threadId', async (req, res) => {
  try {
    const thread = await getThread(req.params.threadId);
    const convo = thread.messages.map(m => `From: ${m.from}\nDate: ${m.date}\n${m.body}`).join('\n---\n');
    const summary = await summarize(convo);
    res.json({ summary, threadId: req.params.threadId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Triage inbox — Claude prioritizes threads
router.get('/triage', async (req, res) => {
  try {
    const threads = await getThreads({ maxResults: 15 });
    const items = threads.map(t => ({
      id: t.id,
      subject: t.subject,
      from: t.from,
      snippet: t.snippet,
      isUnread: t.isUnread,
      messageCount: t.messageCount
    }));
    const triaged = await triageItems(items, 'email');
    res.json({ triaged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark thread as read
router.post('/thread/:id/read', async (req, res) => {
  try {
    await markAsRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unread count
router.get('/unread', async (req, res) => {
  try {
    const counts = await getUnreadCount();
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search
router.get('/search', async (req, res) => {
  try {
    const { q, max = 10 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const threads = await searchEmails(q, parseInt(max));
    res.json({ threads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
