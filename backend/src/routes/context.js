import { Router } from 'express';
import { searchEntities, getEntityContext, getRecentDecisions, getPendingFollowups, completeFollowup } from '../services/context.js';

const router = Router();

// Search entities across all channels
router.get('/entities', (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const entities = searchEntities(q, type || null);
    res.json({ entities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full context for an entity (cross-channel history)
router.get('/entity/:name', (req, res) => {
  try {
    const context = getEntityContext(decodeURIComponent(req.params.name));
    if (!context) return res.status(404).json({ error: 'Entity not found' });
    res.json(context);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recent decisions
router.get('/decisions', (req, res) => {
  try {
    const { limit = 10, entity } = req.query;
    const decisions = getRecentDecisions(parseInt(limit), entity || null);
    res.json({ decisions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pending follow-ups
router.get('/followups', (req, res) => {
  try {
    const followups = getPendingFollowups();
    res.json({ followups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete a follow-up
router.post('/followups/:id/complete', (req, res) => {
  try {
    completeFollowup(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
