import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router();

// Ensure table exists with full schema
let tableReady = false;
function ensureTable() {
  if (tableReady) return;
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS parking_lot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      color TEXT DEFAULT 'gray',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      archived INTEGER DEFAULT 0
    );
  `);
  // Migrate existing tables missing new columns (SQLite ALTER TABLE only allows constant defaults)
  try { db.exec('ALTER TABLE parking_lot ADD COLUMN color TEXT DEFAULT \'gray\''); } catch {}
  try { db.exec('ALTER TABLE parking_lot ADD COLUMN pinned INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE parking_lot ADD COLUMN updated_at TEXT'); } catch {}
  try { db.exec('ALTER TABLE parking_lot ADD COLUMN deleted_at TEXT'); } catch {}
  tableReady = true;
}

const NOTE_FIELDS = 'id, text, color, pinned, created_at, updated_at';

// GET /api/notes — all active notes, pinned first then newest
router.get('/', (req, res) => {
  try {
    ensureTable();
    const db = getDb();
    const notes = db.prepare(
      `SELECT ${NOTE_FIELDS} FROM parking_lot WHERE archived = 0 ORDER BY pinned DESC, id DESC`
    ).all();
    res.json({ notes });
  } catch (e) {
    console.error('Notes GET error:', e);
    res.status(500).json({ error: 'Failed to load notes' });
  }
});

// POST /api/notes — create a note
router.post('/', (req, res) => {
  try {
    ensureTable();
    const { text, color } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    const db = getDb();
    const result = db.prepare(
      'INSERT INTO parking_lot (text, color) VALUES (?, ?)'
    ).run(text.trim(), color || 'gray');
    const note = db.prepare(`SELECT ${NOTE_FIELDS} FROM parking_lot WHERE id = ?`).get(result.lastInsertRowid);
    res.json({ note });
  } catch (e) {
    console.error('Notes POST error:', e);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// PATCH /api/notes/:id — update a note (text, color, pinned)
router.patch('/:id', (req, res) => {
  try {
    ensureTable();
    const db = getDb();
    const { text, color, pinned } = req.body;
    const sets = [];
    const params = [];
    if (text !== undefined) { sets.push('text = ?'); params.push(text.trim()); }
    if (color !== undefined) { sets.push('color = ?'); params.push(color); }
    if (pinned !== undefined) { sets.push('pinned = ?'); params.push(pinned ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE parking_lot SET ${sets.join(', ')} WHERE id = ? AND archived = 0`).run(...params);
    const note = db.prepare(`SELECT ${NOTE_FIELDS} FROM parking_lot WHERE id = ?`).get(req.params.id);
    res.json({ note });
  } catch (e) {
    console.error('Notes PATCH error:', e);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id — archive a note (soft delete)
router.delete('/:id', (req, res) => {
  try {
    ensureTable();
    const db = getDb();
    db.prepare("UPDATE parking_lot SET archived = 1, deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('Notes DELETE error:', e);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
