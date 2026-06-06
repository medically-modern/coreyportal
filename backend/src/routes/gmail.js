import { Router } from 'express';
import { summarize } from '../services/claude.js';

const router = Router();

// TODO: Wire up Gmail API with OAuth2
// For now, stub endpoints that the frontend expects

router.get('/threads', (req, res) => {
  // TODO: google.gmail.users.messages.list
  res.json({ threads: [], message: 'Gmail API not yet connected' });
});

router.get('/thread/:id', (req, res) => {
  // TODO: google.gmail.users.messages.get
  res.json({ thread: null, message: 'Gmail API not yet connected' });
});

router.get('/summarize/:threadId', async (req, res) => {
  try {
    // TODO: fetch thread content first, then summarize
    res.json({ summary: 'Gmail API not yet connected — connect to enable AI summaries' });
  } catch (err) {
    res.status(500).json({ error: 'Summarization failed' });
  }
});

export default router;
