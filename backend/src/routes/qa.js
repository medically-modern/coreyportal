import { Router } from 'express';
import { getDb } from '../db/init.js';
import { draftResponse } from '../services/claude.js';

const router = Router();

// List questions
router.get('/questions', (req, res) => {
  const db = getDb();
  const status = req.query.status || 'pending';
  const questions = db.prepare('SELECT * FROM questions WHERE status = ? ORDER BY created_at DESC').all(status);
  res.json({ questions });
});

// Submit a question (employee-facing)
router.post('/questions', (req, res) => {
  const db = getDb();
  const { from_name, from_email, tag, question, priority } = req.body;
  if (!from_name || !question) return res.status(400).json({ error: 'from_name and question required' });

  const result = db.prepare(
    'INSERT INTO questions (from_name, from_email, tag, question, priority) VALUES (?, ?, ?, ?, ?)'
  ).run(from_name, from_email || null, tag || 'Other', question, priority || 'normal');

  res.json({ id: result.lastInsertRowid, status: 'submitted' });
});

// AI draft for a question
router.post('/questions/:id/ai-draft', async (req, res) => {
  try {
    const db = getDb();
    const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    if (!q) return res.status(404).json({ error: 'Question not found' });

    const { draft } = await draftResponse(q.question, `This is from employee ${q.from_name}, tagged as ${q.tag}`);
    db.prepare('UPDATE questions SET ai_draft = ? WHERE id = ?').run(draft, q.id);
    res.json({ draft });
  } catch (err) {
    res.status(500).json({ error: 'AI draft failed' });
  }
});

// Answer a question
router.post('/questions/:id/answer', (req, res) => {
  const db = getDb();
  const { answer } = req.body;
  if (!answer) return res.status(400).json({ error: 'answer required' });

  db.prepare("UPDATE questions SET answer = ?, status = 'answered', answered_at = datetime('now') WHERE id = ?")
    .run(answer, req.params.id);
  res.json({ status: 'answered' });
});

export default router;
