import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', '..', 'data', 'portal.db');

let db;

export function getDb() {
  if (!db) {
    const dir = dirname(DB_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initDb() {
  const db = getDb();

  db.exec(`
    -- Questions from employees
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_name TEXT NOT NULL,
      from_email TEXT,
      tag TEXT NOT NULL DEFAULT 'Other',
      question TEXT NOT NULL,
      answer TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'normal',
      ai_draft TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      answered_at TEXT
    );

    -- Claude conversation history
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      context_module TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Corey's preferences and patterns (learned by Claude)
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      learned_from TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Settings (OAuth tokens, config)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Action log for audit trail
    CREATE TABLE IF NOT EXISTS action_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log('Database initialized');
}
