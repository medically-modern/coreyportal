import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../db/init.js';

const SYSTEM_PROMPT = `You are Corey's personal AI assistant for Medically Modern, a Durable Medical Equipment (DME) company.

ABOUT COREY:
- CEO of Medically Modern
- Has severe ADD — you must be concise, action-oriented, and never overwhelming
- Deals with: pipeline questions, technology questions, admin questions, former seller questions
- Communication channels: Gmail, Slack, RingCentral (texts + calls), Monday.com

YOUR BEHAVIOR:
- Lead with the single most important thing
- Use bullet points sparingly — max 3-5 items
- Always end with a clear "what to do next" action
- If something can wait, say so explicitly
- If you can handle something without Corey, offer to do it
- Never dump raw data — always summarize and prioritize
- Remember Corey's past decisions and preferences to suggest consistent approaches
- When drafting responses, match Corey's voice: direct, friendly, professional

YOUR CAPABILITIES:
- Summarize email threads and text conversations
- Draft responses in Corey's voice
- Triage and prioritize incoming requests
- Answer employee questions using company knowledge
- Analyze voicemail transcriptions
- Track tasks and deadlines from Monday.com

IMPORTANT:
- If asked about medical advice, insurance claims, or legal matters — always caveat that you're an AI assistant and recommend consulting the appropriate professional
- Never make commitments on Corey's behalf without explicit confirmation`;

let client;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Load conversation history for context
function getRecentHistory(limit = 20) {
  const db = getDb();
  return db.prepare('SELECT role, content FROM conversations ORDER BY id DESC LIMIT ?').all(limit).reverse();
}

// Load Corey's learned preferences
function getPreferences() {
  const db = getDb();
  const prefs = db.prepare('SELECT key, value FROM preferences').all();
  if (prefs.length === 0) return '';
  return '\n\nCOREY\'S KNOWN PREFERENCES:\n' + prefs.map(p => `- ${p.key}: ${p.value}`).join('\n');
}

// Save a message to history
function saveMessage(role, content, contextModule = null) {
  const db = getDb();
  db.prepare('INSERT INTO conversations (role, content, context_module) VALUES (?, ?, ?)').run(role, content, contextModule);
}

// Learn a preference from conversation
function learnPreference(key, value, learnedFrom) {
  const db = getDb();
  db.prepare(`INSERT INTO preferences (key, value, learned_from, updated_at) 
    VALUES (?, ?, ?, datetime('now')) 
    ON CONFLICT(key) DO UPDATE SET value = ?, learned_from = ?, updated_at = datetime('now')`)
    .run(key, value, learnedFrom, value, learnedFrom);
}

export async function chat(userMessage, context = {}) {
  const anthropic = getClient();
  const history = getRecentHistory();
  const preferences = getPreferences();

  const systemPrompt = SYSTEM_PROMPT + preferences;

  // Add context about what module the user is in
  let contextNote = '';
  if (context.module) {
    contextNote = `\n[User is currently viewing the ${context.module} module]`;
  }
  if (context.data) {
    contextNote += `\n[Relevant data: ${JSON.stringify(context.data)}]`;
  }

  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage + contextNote },
  ];

  saveMessage('user', userMessage, context.module);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const assistantMessage = response.content[0].text;
  saveMessage('assistant', assistantMessage, context.module);

  return { message: assistantMessage };
}

export async function summarize(text, type = 'email') {
  const anthropic = getClient();

  const prompt = type === 'email'
    ? `Summarize this email thread for a busy CEO with ADD. Lead with the action needed, then 2-3 key points max:\n\n${text}`
    : type === 'text'
    ? `Summarize this text message conversation for a busy CEO with ADD. What's the situation and what does he need to do:\n\n${text}`
    : `Analyze this voicemail transcription for a busy CEO with ADD. Who called, what they want, urgency level, and recommended action:\n\n${text}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  return { summary: response.content[0].text };
}

export async function draftResponse(originalMessage, context = '') {
  const anthropic = getClient();
  const preferences = getPreferences();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: `Draft a response as Corey, CEO of Medically Modern (DME company). 
Voice: direct, friendly, professional. Keep it short.${preferences}`,
    messages: [{ role: 'user', content: `Draft a reply to this:\n\n${originalMessage}\n\nAdditional context: ${context}` }],
  });

  return { draft: response.content[0].text };
}

export async function triageItems(items) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Triage these items for Corey. Classify each as urgent/warn/normal and sort by priority. Return JSON array with {id, priority, reason, suggestedAction}:\n\n${JSON.stringify(items)}` }],
  });

  return { triage: response.content[0].text };
}

export { learnPreference, getRecentHistory };
