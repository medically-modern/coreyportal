// Elena's Active Memory — learns from conversations, updates knowledge in real-time
import { getDb } from '../db/init.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Detect if a message contains a learning intent
export async function detectLearningIntent(userMessage, assistantResponse) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `Analyze this conversation exchange. Extract any facts that should be permanently remembered. 
Return JSON only: {"facts": [{"category": "patient|insurance|process|preference|employee|vendor|product", "subject": "name or topic", "fact": "what to remember", "action": "learn|update|forget"}]}
Categories:
- patient: info about a specific patient (insurance, preferences, history, conditions)
- insurance: insurance rules, coverage changes, plan details
- process: how things should be done, workflow changes
- preference: Corey's preferences or decision patterns  
- employee: info about team members
- vendor: vendor/partner info
- product: product details, availability, changes

If the user says "remember", "note that", "update", "actually", "from now on", "going forward", or corrects previous info — those are learning signals.
If nothing to learn, return {"facts": []}. JSON only, no markdown.`,
      messages: [{ role: 'user', content: `User: ${userMessage}\n\nAssistant: ${assistantResponse}` }]
    });

    const result = JSON.parse(response.content[0].text.trim());
    return result.facts || [];
  } catch (err) {
    console.error('Learning detection failed:', err.message);
    return [];
  }
}

// Store a learned fact
export function learnFact(category, subject, fact, source = 'conversation') {
  const db = getDb();

  // Check if we already have a fact about this subject in this category
  const existing = db.prepare(
    'SELECT id, fact FROM learned_facts WHERE category = ? AND subject = ? COLLATE NOCASE'
  ).get(category, subject);

  if (existing) {
    // Update existing fact
    db.prepare(
      "UPDATE learned_facts SET fact = ?, updated_at = datetime('now'), source = ? WHERE id = ?"
    ).run(fact, source, existing.id);
    return { action: 'updated', id: existing.id, previous: existing.fact };
  } else {
    // Insert new fact
    const result = db.prepare(
      'INSERT INTO learned_facts (category, subject, fact, source) VALUES (?, ?, ?, ?)'
    ).run(category, subject, fact, source);
    return { action: 'learned', id: result.lastInsertRowid };
  }
}

// Forget a fact
export function forgetFact(category, subject) {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM learned_facts WHERE category = ? AND subject = ? COLLATE NOCASE'
  ).run(category, subject);
  return { deleted: result.changes };
}

// Get all learned facts, optionally filtered
export function getLearnedFacts(category = null, subject = null) {
  const db = getDb();
  let sql = 'SELECT * FROM learned_facts';
  const params = [];
  const conditions = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (subject) {
    conditions.push('subject LIKE ?');
    params.push('%' + subject + '%');
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY updated_at DESC';

  return db.prepare(sql).all(...params);
}

// Search learned facts relevant to a message
export function findRelevantFacts(messageText) {
  const db = getDb();
  const words = messageText.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  if (words.length === 0) return [];

  // Search by subject match
  const allFacts = db.prepare('SELECT * FROM learned_facts ORDER BY updated_at DESC').all();

  const matches = allFacts.filter(fact => {
    const subjectLower = fact.subject.toLowerCase();
    const factLower = fact.fact.toLowerCase();
    return words.some(word =>
      subjectLower.includes(word) || factLower.includes(word)
    );
  });

  return matches.slice(0, 10);
}

// Build a context block from learned facts for Elena's prompt
export function buildLearnedContext(messageText) {
  const facts = findRelevantFacts(messageText);
  const allPreferences = getLearnedFacts('preference');

  const combined = [...facts];
  // Always include preferences
  for (const pref of allPreferences) {
    if (!combined.find(f => f.id === pref.id)) {
      combined.push(pref);
    }
  }

  if (combined.length === 0) return '';

  let prompt = '\n\n## ELENA\'S LEARNED MEMORY (from past conversations)\n';

  const byCategory = {};
  for (const fact of combined) {
    if (!byCategory[fact.category]) byCategory[fact.category] = [];
    byCategory[fact.category].push(fact);
  }

  for (const [cat, facts] of Object.entries(byCategory)) {
    prompt += '\n### ' + cat.charAt(0).toUpperCase() + cat.slice(1) + ':\n';
    for (const f of facts) {
      prompt += '- **' + f.subject + '**: ' + f.fact;
      if (f.updated_at) prompt += ' (learned ' + f.updated_at.substring(0, 10) + ')';
      prompt += '\n';
    }
  }

  return prompt;
}

// Process a completed chat exchange for learning
export async function processForLearning(userMessage, assistantResponse) {
  const facts = await detectLearningIntent(userMessage, assistantResponse);

  const results = [];
  for (const fact of facts) {
    if (fact.action === 'forget') {
      const r = forgetFact(fact.category, fact.subject);
      results.push({ ...fact, result: r });
    } else {
      const r = learnFact(fact.category, fact.subject, fact.fact);
      results.push({ ...fact, result: r });
    }
  }

  return results;
}
