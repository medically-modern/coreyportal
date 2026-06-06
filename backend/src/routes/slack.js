import { Router } from 'express';
import { summarize, triageItems } from '../services/claude.js';
import { ingestContent } from '../services/context.js';
import { checkConnection, getChannels, getChannelMessages, getThreadReplies, searchMessages, getDMs, postMessage } from '../services/slack.js';

const router = Router();

// Connection status
router.get('/status', async (req, res) => {
  try {
    const status = await checkConnection();
    res.json(status);
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// List channels
router.get('/channels', async (req, res) => {
  try {
    const channels = await getChannels();
    res.json({ channels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Channel messages
router.get('/channels/:id/messages', async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const messages = await getChannelMessages(req.params.id, parseInt(limit));

    // Ingest for Elena's context engine
    const text = messages.map(m => `${m.user}: ${m.text}`).join('\n');
    ingestContent(text, 'slack', req.params.id).catch(() => {});

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Thread replies
router.get('/channels/:id/thread/:ts', async (req, res) => {
  try {
    const replies = await getThreadReplies(req.params.id, req.params.ts);
    res.json({ replies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Summarize a channel's recent activity
router.get('/channels/:id/summarize', async (req, res) => {
  try {
    const messages = await getChannelMessages(req.params.id, 50);
    const text = messages.map(m => `${m.user} (${m.timestamp}): ${m.text}`).join('\n');
    const summary = await summarize(text, 'slack channel');
    res.json({ summary, channelId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Triage — what needs Corey's attention across channels
router.get('/triage', async (req, res) => {
  try {
    const channels = await getChannels();
    const allMessages = [];

    for (const ch of channels.slice(0, 8)) {
      try {
        const msgs = await getChannelMessages(ch.id, 10);
        for (const m of msgs) {
          allMessages.push({ ...m, channel: ch.name, channelId: ch.id });
        }
      } catch { /* skip channels bot can't read */ }
    }

    const triaged = await triageItems(allMessages, 'slack messages');
    res.json({ triaged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const results = await searchMessages(q, parseInt(limit));
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DMs
router.get('/dms', async (req, res) => {
  try {
    const messages = await getDMs();
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
