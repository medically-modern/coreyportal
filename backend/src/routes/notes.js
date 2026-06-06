import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router();

// Ensure table exists on first load
let tableReady = false;
function ensureTable() {
  if (tableReady) return;
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS parking_lot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      archived INTEGER DEFAULT 0
    );
  `);
  tableReady = true;
}

// GET /api/notes — all active notes, newest first
router.get('/', (req, res) => {
  try {
    ensureTable();
    const db = getDb();
    const notes = db.prepare(
      'SELECT id, text, created_at FROM parking_lot WHERE archived = 0 ORDER BY id DESC'
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
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    const db = getDb();
    const result = db.prepare(
      'INSERT INTO parking_lot (text) VALUES (?)'
    ).run(text.trim());
    const note = db.prepare('SELECT id, text, created_at FROM parking_lot WHERE id = ?').get(result.lastInsertRowid);
    res.json({ note });
  } catch (e) {
    console.error('Notes POST error:', e);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// DELETE /api/notes/:id — archive a note (soft delete)
router.delete('/:id', (req, res) => {
  try {
    ensureTable();
    const db = getDb();
    db.prepare('UPDATE parking_lot SET archived = 1 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('Notes DELETE error:', e);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
