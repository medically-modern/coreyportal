import { Router } from 'express';
import { getDb } from '../db/init.js';
import { draftResponse } from '../services/claude.js';
import multer from 'multer';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __qaDirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.NODE_ENV === 'production'
  ? '/data/qa-uploads'
  : join(__qaDirname, '..', '..', 'data', 'qa-uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.png', '.jpg', '.jpeg', '.heic', '.gif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.has(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not allowed`));
  },
});

const router = Router();

// Attachments table
try {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS question_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      stored_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      uploaded_by TEXT DEFAULT 'employee',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (e) { console.error('attachments table error:', e.message); }

function attachmentsFor(db, questionIds) {
  if (!questionIds.length) return {};
  const placeholders = questionIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id, question_id, original_name, mime, size, uploaded_by, created_at FROM question_attachments WHERE question_id IN (${placeholders})`).all(...questionIds);
  const map = {};
  rows.forEach(r => { (map[r.question_id] = map[r.question_id] || []).push(r); });
  return map;
}

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
  const attMap = attachmentsFor(db, questions.map(q => q.id));
  questions.forEach(q => { q.attachments = attMap[q.id] || []; });
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
  const attMap = attachmentsFor(db, questions.map(q => q.id));
  questions.forEach(q => { q.attachments = attMap[q.id] || []; });
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

// ---- ATTACHMENTS ----

// Upload files to a question (employee submit form or Corey's view)
router.post('/questions/:id/attachments', (req, res) => {
  upload.array('files', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const db = getDb();
      const q = db.prepare('SELECT id FROM questions WHERE id = ?').get(req.params.id);
      if (!q) return res.status(404).json({ error: 'Question not found' });
      const uploadedBy = req.body.uploaded_by === 'corey' ? 'corey' : 'employee';
      const insert = db.prepare('INSERT INTO question_attachments (question_id, stored_name, original_name, mime, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)');
      const saved = (req.files || []).map(f => {
        const r = insert.run(req.params.id, f.filename, f.originalname, f.mimetype || '', f.size || 0, uploadedBy);
        return { id: r.lastInsertRowid, question_id: Number(req.params.id), original_name: f.originalname, mime: f.mimetype, size: f.size, uploaded_by: uploadedBy };
      });
      res.json({ attachments: saved });
    } catch (e) {
      console.error('Attachment save error:', e);
      res.status(500).json({ error: e.message });
    }
  });
});

// Download an attachment
router.get('/attachments/:id/download', (req, res) => {
  try {
    const db = getDb();
    const att = db.prepare('SELECT * FROM question_attachments WHERE id = ?').get(req.params.id);
    if (!att) return res.status(404).json({ error: 'Not found' });
    const filePath = join(UPLOAD_DIR, att.stored_name);
    if (!existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });
    res.download(filePath, att.original_name);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete an attachment
router.delete('/attachments/:id', (req, res) => {
  try {
    const db = getDb();
    const att = db.prepare('SELECT * FROM question_attachments WHERE id = ?').get(req.params.id);
    if (!att) return res.status(404).json({ error: 'Not found' });
    try { unlinkSync(join(UPLOAD_DIR, att.stored_name)); } catch (e) { /* file already gone */ }
    db.prepare('DELETE FROM question_attachments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
