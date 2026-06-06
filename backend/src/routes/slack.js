import { Router } from 'express';

const router = Router();

// TODO: Wire up Slack Web API
// The plan: intercept @corey mentions, route question-type messages to the Q&A system

router.get('/mentions', (req, res) => {
  // TODO: conversations.history filtered for mentions
  res.json({ mentions: [], message: 'Slack API not yet connected' });
});

router.post('/reply', (req, res) => {
  // TODO: chat.postMessage
  res.json({ status: 'Slack API not yet connected' });
});

export default router;
