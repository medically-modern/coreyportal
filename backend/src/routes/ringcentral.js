import { Router } from 'express';
import { summarize } from '../services/claude.js';

const router = Router();

// TODO: Wire up RingCentral API

router.get('/messages', (req, res) => {
  // TODO: RC message-store API
  res.json({ conversations: [], message: 'RingCentral API not yet connected' });
});

router.get('/summarize/:conversationId', async (req, res) => {
  try {
    // TODO: fetch convo, then summarize
    res.json({ summary: 'RingCentral API not yet connected' });
  } catch (err) {
    res.status(500).json({ error: 'Summarization failed' });
  }
});

router.get('/voicemails', (req, res) => {
  // TODO: RC voicemail API + transcription
  res.json({ voicemails: [], message: 'RingCentral API not yet connected' });
});

export default router;
