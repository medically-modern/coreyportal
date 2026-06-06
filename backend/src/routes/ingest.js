import { Router } from 'express';
import { ingestContent } from '../services/context.js';
import { learnFact, getLearnedFacts } from '../services/memory.js';

const router = Router();

// Manual fact teaching
router.post('/teach', (req, res) => {
  try {
    const { category, subject, fact } = req.body;
    if (!category || !subject || !fact) {
      return res.status(400).json({ error: 'category, subject, and fact required' });
    }
    const result = learnFact(category, subject, fact, 'manual');
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk teach (array of facts)
router.post('/teach/bulk', (req, res) => {
  try {
    const { facts } = req.body;
    if (!Array.isArray(facts)) return res.status(400).json({ error: 'facts array required' });

    const results = facts.map(f => {
      try {
        return { ...f, result: learnFact(f.category, f.subject, f.fact, f.source || 'bulk') };
      } catch (err) {
        return { ...f, error: err.message };
      }
    });

    res.json({ success: true, processed: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// View what Elena has learned
router.get('/memory', (req, res) => {
  try {
    const { category, subject } = req.query;
    const facts = getLearnedFacts(category || null, subject || null);
    res.json({ facts, total: facts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger ingestion from a specific channel
router.post('/ingest/:channel', async (req, res) => {
  try {
    const { channel } = req.params;
    const { text, sourceId } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    const entities = await ingestContent(text, channel, sourceId || '');
    res.json({ success: true, entities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
