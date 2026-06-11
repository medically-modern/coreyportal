import { Router } from 'express';
import {
  getTextConversations,
  getConversationMessages,
  getFullConversation,
  sendSMS,
  getVoicemails,
  getCallLog,
  getMissedCalls,
  checkConnection,
  markMessagesRead,
} from '../services/ringcentral.js';
import { summarize, organizeItems } from '../services/claude.js';
import { saveLabels, loadLabels } from './gmail.js';

const router = Router();

// Elena organize — reads all unread text conversations, ranks them, persists labels
router.post('/organize', async (req, res) => {
  try {
    const convos = await getTextConversations(250, 90);
    const unread = convos.filter(c => c.unread > 0);
    if (unread.length === 0) return res.json({ labels: [], organizedAt: new Date().toISOString() });

    const items = unread.map(c => ({
      id: c.contact,
      from: c.contact,
      snippet: (c.messages || []).slice(0, 5).map(m => `[${m.direction}] ${m.text || ''}`).join(' | ').slice(0, 500),
      unreadCount: c.unread,
      date: c.lastMessageTime,
    }));
    const labels = await organizeItems(items, 'text');
    saveLabels('rc', labels);
    res.json({ labels, organizedAt: new Date().toISOString() });
  } catch (err) {
    console.error('RC organize error:', err);
    res.status(500).json({ error: 'Organize failed', detail: err.message });
  }
});

// Saved Elena labels (no AI call)
router.get('/organize', (req, res) => {
  try {
    res.json({ labels: loadLabels('rc') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// Full conversation history for a phone number
router.get('/conversation/:phoneNumber', async (req, res) => {
  try {
    const messages = await getFullConversation(req.params.phoneNumber, parseInt(req.query.days) || 90);
    res.json({ messages, phone: req.params.phoneNumber });
  } catch (err) {
    console.error('RC conversation error:', err.message);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Mark messages as read (processed)
router.post('/mark-read', async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds array required' });
    }
    const result = await markMessagesRead(messageIds);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('RC mark-read error:', err.message);
    res.status(500).json({ error: 'Failed to mark as read', detail: err.message });
  }
});

// Send SMS
router.post('/send-sms', async (req, res) => {
  try {
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ error: 'to and text are required' });
    const result = await sendSMS(to, text);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('RC send SMS error:', err);
    res.status(500).json({ error: 'Failed to send SMS', detail: err.message });
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
