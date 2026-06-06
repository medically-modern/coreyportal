// Elena's Context Engine — cross-channel memory and entity tracking
import { getDb } from '../db/init.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Extract entities (patients, people, companies) from any text using Claude
export async function extractEntities(text, channel, sourceId) {
  if (!text || text.length < 10) return [];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: 'Extract named entities from this text. Return JSON array only. Each object: {"name": "full name", "type": "patient|employee|vendor|partner|unknown", "context": "one-line what this is about"}. If no entities found, return []. JSON only, no markdown.',
      messages: [{ role: 'user', content: text.substring(0, 2000) }]
    });

    const raw = response.content[0].text.trim();
    const entities = JSON.parse(raw);

    const db = getDb();
    const upsertEntity = db.prepare(`
      INSERT INTO entities (name, type, first_seen_channel, first_seen_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(name) DO UPDATE SET last_seen_at = datetime('now')
    `);
    const insertMention = db.prepare(`
      INSERT INTO mentions (entity_name, channel, source_id, context, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);

    for (const e of entities) {
      upsertEntity.run(e.name, e.type, channel);
      insertMention.run(e.name, channel, sourceId || '', e.context);
    }

    return entities;
  } catch (err) {
    console.error('Entity extraction failed:', err.message);
    return [];
  }
}

// Get full context for an entity across all channels
export function getEntityContext(name) {
  const db = getDb();

  const entity = db.prepare('SELECT * FROM entities WHERE name LIKE ?').get(`%${name}%`);
  if (!entity) return null;

  const mentions = db.prepare(`
    SELECT * FROM mentions WHERE entity_name LIKE ? ORDER BY created_at DESC LIMIT 20
  `).all(`%${name}%`);

  const decisions = db.prepare(`
    SELECT * FROM decisions WHERE entities LIKE ? ORDER BY created_at DESC LIMIT 5
  `).all(`%${name}%`);

  return { entity, mentions, decisions };
}

// Search for entities matching a query
export function searchEntities(query, type = null) {
  const db = getDb();
  let sql = 'SELECT * FROM entities WHERE name LIKE ?';
  const params = [`%${query}%`];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY last_seen_at DESC LIMIT 20';
  return db.prepare(sql).all(...params);
}

// Log a decision Corey made — builds pattern recognition
export function logDecision(summary, reasoning, entities = [], channel = 'assistant') {
  const db = getDb();
  db.prepare(`
    INSERT INTO decisions (summary, reasoning, entities, channel, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(summary, reasoning, JSON.stringify(entities), channel);
}

// Get recent decisions, optionally filtered
export function getRecentDecisions(limit = 10, entityFilter = null) {
  const db = getDb();
  if (entityFilter) {
    return db.prepare(`
      SELECT * FROM decisions WHERE entities LIKE ? ORDER BY created_at DESC LIMIT ?
    `).all(`%${entityFilter}%`, limit);
  }
  return db.prepare('SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?').all(limit);
}

// Log a follow-up that needs tracking
export function addFollowup(description, dueDate = null, relatedEntity = null, channel = 'assistant') {
  const db = getDb();
  db.prepare(`
    INSERT INTO followups (description, due_date, related_entity, channel, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', datetime('now'))
  `).run(description, dueDate, relatedEntity, channel);
}

// Get pending follow-ups
export function getPendingFollowups() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM followups WHERE status = 'pending' ORDER BY
    CASE WHEN due_date IS NOT NULL THEN 0 ELSE 1 END,
    due_date ASC, created_at ASC
  `).all();
}

// Mark follow-up complete
export function completeFollowup(id) {
  const db = getDb();
  db.prepare("UPDATE followups SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(id);
}

// Build full context object for Elena given a message
export async function buildContextForMessage(messageText) {
  const db = getDb();

  // Extract entities from the incoming message
  const entities = await extractEntities(messageText, 'assistant', '');

  const context = {
    relatedEntities: [],
    recentDecisions: [],
    activeIssues: [],
    pendingFollowups: []
  };

  // For each entity mentioned, pull cross-channel history
  for (const e of entities) {
    const full = getEntityContext(e.name);
    if (full) {
      const channels = [...new Set(full.mentions.map(m => m.channel))];
      context.relatedEntities.push({
        name: e.name,
        type: full.entity.type,
        summary: `Seen in ${channels.join(', ')}. ${full.mentions.length} mentions. Latest: ${full.mentions[0]?.context || 'N/A'}`
      });

      // Pull decisions related to this entity
      for (const d of full.decisions) {
        context.recentDecisions.push({
          date: d.created_at,
          summary: d.summary
        });
      }
    }
  }

  // Add pending follow-ups
  const followups = getPendingFollowups();
  context.pendingFollowups = followups.slice(0, 5).map(f => ({
    description: f.description,
    due: f.due_date
  }));

  // Deduplicate decisions
  const seen = new Set();
  context.recentDecisions = context.recentDecisions.filter(d => {
    if (seen.has(d.summary)) return false;
    seen.add(d.summary);
    return true;
  }).slice(0, 5);

  return context;
}

// Ingest content from any channel for entity tracking
export async function ingestContent(text, channel, sourceId = '') {
  return extractEntities(text, channel, sourceId);
}
