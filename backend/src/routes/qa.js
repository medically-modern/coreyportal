import { Router } from 'express';
import { getDb } from '../db/init.js';
import { draftResponse } from '../services/claude.js';

const router = Router();

// Migrate: add headline column if missing
try {
  const db0 = getDb();
  db0.exec("ALTER TABLE questions ADD COLUMN headline TEXT");
} catch (e) { /* column already exists */ }


// List questions
router.get('/questions', (req, res) => {
  const db = getDb();
  const status = req.query.status || 'pending';
  const questions = status === 'all' ? db.prepare('SELECT * FROM questions ORDER BY created_at DESC').all() : db.prepare('SELECT * FROM questions WHERE status = ? ORDER BY created_at DESC').all(status);
  res.json({ questions });
});

// Submit a question (employee-facing)
router.post('/questions', (req, res) => {
  const db = getDb();
  // Accept both old field names and new submit form fields
  const from_name = req.body.from_name || req.body.from;
  const headline = req.body.headline || '';
  const question = req.body.question;
  const tag = req.body.tag || req.body.category || 'Other';
  const priority = req.body.priority || req.body.urgency || 'medium';
  const from_email = req.body.from_email || null;
  const patient_name = req.body.patient_name || '';
  const context = req.body.context || '';
  
  if (!from_name || !question) return res.status(400).json({ error: 'name and question required' });

  // Append patient name and context to question for Corey's visibility
  let fullQuestion = question;
  if (patient_name) fullQuestion = `[Patient: ${patient_name}] ${fullQuestion}`;
  if (context) fullQuestion += '\n\nContext: ' + context;

  const result = db.prepare(
    'INSERT INTO questions (from_name, from_email, tag, headline, question, priority) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(from_name, from_email, tag, headline, fullQuestion, priority);

  res.json({ id: result.lastInsertRowid, status: 'submitted' });
});

// Get all questions (support 'all' filter)
router.get('/questions/all', (req, res) => {
  const db = getDb();
  const questions = db.prepare('SELECT * FROM questions ORDER BY created_at DESC').all();
  res.json({ questions });
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

// Archive a question
router.post('/questions/:id/archive', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE questions SET status = 'archived' WHERE id = ?").run(req.params.id);
  res.json({ status: 'archived' });
});

// Restore from archive
router.post('/questions/:id/restore', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE questions SET status = 'pending' WHERE id = ?").run(req.params.id);
  res.json({ status: 'pending' });
});
