import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/data/portal.db'
  : join(__dirname, '..', '..', 'data', 'portal.db');

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
      headline TEXT,
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

    
    -- Entity tracking (patients, employees, vendors across all channels)
    CREATE TABLE IF NOT EXISTS entities (
      name TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'unknown',
      first_seen_channel TEXT,
      first_seen_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT DEFAULT (datetime('now')),
      notes TEXT
    );

    -- Every mention of an entity across any channel
    CREATE TABLE IF NOT EXISTS mentions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_name TEXT NOT NULL,
      channel TEXT NOT NULL,
      source_id TEXT,
      context TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (entity_name) REFERENCES entities(name)
    );

    -- Decisions Corey has made (for pattern learning)
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary TEXT NOT NULL,
      reasoning TEXT,
      entities TEXT,
      channel TEXT NOT NULL DEFAULT 'assistant',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Follow-ups Elena is tracking
    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      due_date TEXT,
      related_entity TEXT,
      channel TEXT NOT NULL DEFAULT 'assistant',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    
    -- Elena's learned facts (persistent memory from conversations)
    CREATE TABLE IF NOT EXISTS learned_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      fact TEXT NOT NULL,
      source TEXT DEFAULT 'conversation',
      confidence TEXT DEFAULT 'confirmed',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Create index for fast lookup
    CREATE INDEX IF NOT EXISTS idx_learned_subject ON learned_facts(subject);
    CREATE INDEX IF NOT EXISTS idx_learned_category ON learned_facts(category);

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
