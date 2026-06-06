import { Router } from 'express';
import {
  getTextConversations,
  getConversationMessages,
  getVoicemails,
  getCallLog,
  getMissedCalls,
  checkConnection,
} from '../services/ringcentral.js';
import { summarize } from '../services/claude.js';

const router = Router();

// Health / connection check
router.get('/status', async (req, res) => {
  try {
    const status = await checkConnection();
    res.json(status);
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// Text conversations (grouped by contact)
router.get('/messages', async (req, res) => {
  try {
    const convos = await getTextConversations(parseInt(req.query.perPage) || 100, parseInt(req.query.daysBack) || null);
    res.json({ conversations: convos });
  } catch (err) {
    console.error('RC messages error:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages', detail: err.message });
  }
});

// Messages for a specific phone number
router.get('/messages/:phoneNumber', async (req, res) => {
  try {
    const messages = await getConversationMessages(req.params.phoneNumber);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Summarize a text conversation with Claude
router.get('/summarize/:phoneNumber', async (req, res) => {
  try {
    const messages = await getConversationMessages(req.params.phoneNumber);
    if (!messages.length) {
      return res.json({ summary: 'No messages found for this contact.' });
    }

    const convoText = messages
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .map(m => `[${m.direction}] ${m.text}`)
      .join('\n');

    const { summary } = await summarize(convoText, 'text');
    res.json({ summary, messageCount: messages.length });
  } catch (err) {
    console.error('RC summarize error:', err.message);
    res.status(500).json({ error: 'Summarization failed' });
  }
});

// Voicemails
router.get('/voicemails', async (req, res) => {
  try {
    const voicemails = await getVoicemails(parseInt(req.query.perPage) || 20);
    res.json({ voicemails });
  } catch (err) {
    console.error('RC voicemails error:', err.message);
    res.status(500).json({ error: 'Failed to fetch voicemails', detail: err.message });
  }
});

// Call log
router.get('/calls', async (req, res) => {
  try {
    const calls = await getCallLog(parseInt(req.query.perPage) || 25);
    res.json({ calls });
  } catch (err) {
    console.error('RC call log error:', err.message);
    res.status(500).json({ error: 'Failed to fetch call log' });
  }
});

// Missed calls only
router.get('/missed', async (req, res) => {
  try {
    const missed = await getMissedCalls();
    res.json({ missed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch missed calls' });
  }
});

export default router;
