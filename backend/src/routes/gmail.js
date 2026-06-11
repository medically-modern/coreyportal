import { Router } from 'express';
import { summarize, triageItems, organizeItems } from '../services/claude.js';
import { getAuthUrl, handleCallback, checkConnection, getThreads, getThread, markAsRead, getUnreadCount, searchEmails, sendReply } from '../services/gmail.js';
import { getDb } from '../db/init.js';

const router = Router();

function saveLabels(channel, labels) {
  const db = getDb();
  const stmt = db.prepare(`INSERT OR REPLACE INTO elena_labels (channel, item_id, urgency, label, reason, priority, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`);
  const tx = db.transaction((rows) => {
    for (const r of rows) stmt.run(channel, r.id, r.urgency, r.label, r.reason, r.priority);
  });
  tx(labels);
}

function loadLabels(channel) {
  const db = getDb();
  return db.prepare('SELECT item_id as id, urgency, label, reason, priority, created_at FROM elena_labels WHERE channel = ? ORDER BY priority ASC').all(channel);
}

export { saveLabels, loadLabels };

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

// Inbox threads (paginated — pass pageToken to get the next page)
router.get('/threads', async (req, res) => {
  try {
    const { max = 50, q = '', pageToken = null } = req.query;
    const { threads, nextPageToken } = await getThreads({ maxResults: parseInt(max), q, pageToken });
    res.json({ threads, nextPageToken });
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
    const { threads } = await getThreads({ maxResults: 15 });
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

// Elena organize — reads ALL unread emails, ranks them, persists labels
router.post('/organize', async (req, res) => {
  try {
    // Page through every unread thread in the inbox
    let all = [];
    let pageToken = null;
    do {
      const { threads, nextPageToken } = await getThreads({ maxResults: 100, q: 'is:unread', pageToken });
      all = all.concat(threads);
      pageToken = nextPageToken;
    } while (pageToken && all.length < 400);

    if (all.length === 0) return res.json({ labels: [], organizedAt: new Date().toISOString() });

    const items = all.map(t => ({
      id: t.id,
      from: t.from,
      subject: t.subject,
      snippet: t.snippet,
      date: t.date,
    }));
    const labels = await organizeItems(items, 'email');
    saveLabels('email', labels);
    res.json({ labels, organizedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Gmail organize error:', err);
    res.status(500).json({ error: 'Organize failed', detail: err.message });
  }
});

// Saved Elena labels (no AI call — loads on every page view)
router.get('/organize', (req, res) => {
  try {
    res.json({ labels: loadLabels('email') });
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
    const { q, max = 50 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const { threads, nextPageToken } = await searchEmails(q, parseInt(max));
    res.json({ threads, nextPageToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a reply to a thread
router.post('/reply', async (req, res) => {
  try {
    const { threadId, to, subject, body } = req.body;
    if (!threadId || !to || !body) {
      return res.status(400).json({ error: 'threadId, to, and body are required' });
    }

    // Get the last message in thread for In-Reply-To header
    let inReplyTo = null;
    let references = null;
    try {
      const thread = await getThread(threadId);
      const lastMsg = thread.messages[thread.messages.length - 1];
      if (lastMsg?.id) {
        // Gmail message IDs can be used as references
        inReplyTo = `<${lastMsg.id}@mail.gmail.com>`;
        references = inReplyTo;
      }
    } catch {}

    const result = await sendReply({ threadId, to, subject, body, inReplyTo, references });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Gmail reply error:', err);
    res.status(500).json({ error: 'Failed to send reply', detail: err.message });
  }
});

export default router;
