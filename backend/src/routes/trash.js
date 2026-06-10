import { Router } from 'express';
import { getDb } from '../db/init.js';
import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __trashDirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.NODE_ENV === 'production'
  ? '/data/qa-uploads'
  : join(__trashDirname, '..', '..', 'data', 'qa-uploads');

const router = Router();

// Lightweight migrations — timestamps for trash entries (no-op if present)
function ensureColumns() {
  const db = getDb();
  const alters = [
    "ALTER TABLE projects ADD COLUMN deleted_at TEXT DEFAULT NULL",
    "ALTER TABLE project_tasks ADD COLUMN deleted_at TEXT DEFAULT NULL",
    "ALTER TABLE parking_lot ADD COLUMN deleted_at TEXT DEFAULT NULL",
    "ALTER TABLE question_attachments ADD COLUMN deleted_at TEXT DEFAULT NULL",
  ];
  for (const a of alters) { try { db.exec(a); } catch (e) { /* exists */ } }
}

// ---- List everything in the trash ----
router.get('/', (req, res) => {
  try {
    ensureColumns();
    const db = getDb();
    const projects = db.prepare(
      'SELECT id, name, color, type, deleted_at FROM projects WHERE archived = 1'
    ).all();
    const tasks = db.prepare(`
      SELECT t.id, t.title, t.deleted_at, t.project_id, p.name AS project_name, p.archived AS project_archived
      FROM project_tasks t LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.deleted_at IS NOT NULL
    `).all();
    const notes = db.prepare(
      'SELECT id, text, color, deleted_at FROM parking_lot WHERE archived = 1'
    ).all();
    const attachments = db.prepare(`
      SELECT a.id, a.original_name, a.size, a.deleted_at, a.question_id, q.headline AS question_headline
      FROM question_attachments a LEFT JOIN questions q ON q.id = a.question_id
      WHERE a.deleted_at IS NOT NULL
    `).all();
    res.json({ projects, tasks, notes, attachments });
  } catch (err) {
    console.error('Trash list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Restore one item ----
router.post('/restore', (req, res) => {
  try {
    ensureColumns();
    const db = getDb();
    const { type, id } = req.body;
    if (!type || !id) return res.status(400).json({ error: 'type and id required' });
    switch (type) {
      case 'project':
        db.prepare('UPDATE projects SET archived = 0, deleted_at = NULL WHERE id = ?').run(id);
        break;
      case 'task':
        db.prepare('UPDATE project_tasks SET deleted_at = NULL WHERE id = ?').run(id);
        break;
      case 'note':
        db.prepare('UPDATE parking_lot SET archived = 0, deleted_at = NULL WHERE id = ?').run(id);
        break;
      case 'attachment':
        db.prepare('UPDATE question_attachments SET deleted_at = NULL WHERE id = ?').run(id);
        break;
      default:
        return res.status(400).json({ error: `Unknown type: ${type}` });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Permanently delete one item ----
function purgeProject(db, id) {
  db.prepare('DELETE FROM project_tasks WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM project_columns WHERE project_id = ?').run(id);
  try { db.prepare('DELETE FROM project_members WHERE project_id = ?').run(id); } catch (e) {}
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

function purgeAttachment(db, att) {
  if (att) {
    try {
      const f = join(UPLOAD_DIR, att.stored_name);
      if (existsSync(f)) unlinkSync(f);
    } catch (e) { console.error('File unlink error:', e.message); }
    db.prepare('DELETE FROM question_attachments WHERE id = ?').run(att.id);
  }
}

router.delete('/item', (req, res) => {
  try {
    ensureColumns();
    const db = getDb();
    const { type, id } = req.body;
    if (!type || !id) return res.status(400).json({ error: 'type and id required' });
    switch (type) {
      case 'project':
        purgeProject(db, id);
        break;
      case 'task':
        db.prepare('DELETE FROM project_tasks WHERE id = ?').run(id);
        break;
      case 'note':
        db.prepare('DELETE FROM parking_lot WHERE id = ?').run(id);
        break;
      case 'attachment':
        purgeAttachment(db, db.prepare('SELECT * FROM question_attachments WHERE id = ?').get(id));
        break;
      default:
        return res.status(400).json({ error: `Unknown type: ${type}` });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Empty the entire trash (permanent) ----
router.post('/empty', (req, res) => {
  try {
    ensureColumns();
    const db = getDb();
    const counts = { projects: 0, tasks: 0, notes: 0, attachments: 0 };

    const projects = db.prepare('SELECT id FROM projects WHERE archived = 1').all();
    projects.forEach(p => { purgeProject(db, p.id); counts.projects++; });

    const tasks = db.prepare('SELECT id FROM project_tasks WHERE deleted_at IS NOT NULL').all();
    tasks.forEach(t => { db.prepare('DELETE FROM project_tasks WHERE id = ?').run(t.id); counts.tasks++; });

    const notes = db.prepare('SELECT id FROM parking_lot WHERE archived = 1').all();
    notes.forEach(n => { db.prepare('DELETE FROM parking_lot WHERE id = ?').run(n.id); counts.notes++; });

    const atts = db.prepare('SELECT * FROM question_attachments WHERE deleted_at IS NOT NULL').all();
    atts.forEach(a => { purgeAttachment(db, a); counts.attachments++; });

    res.json({ ok: true, purged: counts });
  } catch (err) {
    console.error('Empty trash error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
