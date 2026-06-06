import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../db/init.js';
import { ELENA_SYSTEM_PROMPT, ELENA_CONTEXT_PROMPT, ADHD_COMMUNICATION_PROFILE } from '../config/elena-personality.js';
import { KNOWLEDGE_BASE } from '../config/elena-knowledge-base.js';
import { SLACK_KNOWLEDGE } from '../config/elena-slack-knowledge.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PATIENT_DIRECTORY = require('../config/patient-directory.json');
import { buildContextForMessage, logDecision, addFollowup, ingestContent } from './context.js';
import { buildLearnedContext, processForLearning } from './memory.js';

const anthropic = new Anthropic();

// Chat with Elena — full context-aware conversation
export async function chat(userMessage, contextModule = null) {
  const db = getDb();

  // Build cross-channel context from the message
  const context = await buildContextForMessage(userMessage);
  const contextBlock = ELENA_CONTEXT_PROMPT(context);

  // Get conversation history (last 20 messages)
  const history = db.prepare(
    'SELECT role, content FROM conversations ORDER BY created_at DESC LIMIT 20'
  ).all().reverse();

  // Build system prompt with live context
  let systemPrompt = ELENA_SYSTEM_PROMPT + ADHD_COMMUNICATION_PROFILE + '\n\n' + KNOWLEDGE_BASE + '\n\n' + SLACK_KNOWLEDGE + contextBlock;

  // Add Elena's learned memory
  const learnedMemory = buildLearnedContext(userMessage);
  if (learnedMemory) systemPrompt += learnedMemory;

  // Check if any known patients are mentioned
  const patientContext = findPatientContext(userMessage);
  if (patientContext) systemPrompt += patientContext;

  if (contextModule) {
    systemPrompt += `\n\nCorey is currently in the ${contextModule} module of the portal.`;
  }

  // Build messages array
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage }
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages
  });

  const assistantMessage = response.content[0].text;

  // Save to conversation history
  db.prepare('INSERT INTO conversations (role, content, context_module) VALUES (?, ?, ?)').run('user', userMessage, contextModule);
  db.prepare('INSERT INTO conversations (role, content, context_module) VALUES (?, ?, ?)').run('assistant', assistantMessage, contextModule);

  // Ingest entities from both messages for context tracking
  await ingestContent(userMessage, contextModule || 'assistant', '');
  await ingestContent(assistantMessage, 'assistant', '');

  // Detect if Elena suggested a decision or follow-up (async, non-blocking)
  detectAndLogActions(assistantMessage).catch(() => {});

  // Process for learning (async, non-blocking)
  processForLearning(userMessage, assistantMessage).catch(() => {});

  return assistantMessage;
}

// One-shot Elena call — no conversation history, no DB save
// Used for focus-context, briefings, and other stateless analysis
export async function oneShot(prompt, systemOverride = null) {
  const system = systemOverride || 'You are Elena, a warm and direct assistant for Corey, CEO of Medically Modern (a DME company). Be concise and specific.';
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
}

// Summarize any content through Elena's lens
export async function summarize(content, contentType = 'conversation') {
  const context = await buildContextForMessage(content);
  const contextBlock = ELENA_CONTEXT_PROMPT(context);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: ELENA_SYSTEM_PROMPT + contextBlock + `\n\nYou are summarizing a ${contentType} for Corey. Remember: lead with the most important thing, max 3-5 bullets, end with what Corey should do (if anything). If you recognize any patients, employees, or issues from your context, connect the dots.`,
    messages: [{ role: 'user', content: `Summarize this:\n\n${content}` }]
  });

  // Track entities in summarized content
  await ingestContent(content, contentType, '');

  return response.content[0].text;
}

// Draft a response in Corey's voice
export async function draftResponse(originalMessage, channel = 'email') {
  const context = await buildContextForMessage(originalMessage);
  const contextBlock = ELENA_CONTEXT_PROMPT(context);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: ELENA_SYSTEM_PROMPT + contextBlock + `\n\nDraft a reply for Corey to send via ${channel}. Match his tone: professional but personable, direct, confident. Use any relevant context you have about the person or issue. Keep it concise.`,
    messages: [{ role: 'user', content: `Draft a reply to this:\n\n${originalMessage}` }]
  });

  return response.content[0].text;
}

// Triage items — prioritize for ADHD brain
export async function triageItems(items, itemType = 'messages') {
  const context = await buildContextForMessage(JSON.stringify(items));
  const contextBlock = ELENA_CONTEXT_PROMPT(context);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: ELENA_SYSTEM_PROMPT + contextBlock + `\n\nTriage these ${itemType} for Corey. Categorize each as:
- 🔴 DO NOW — time-sensitive or high-impact, needs Corey specifically
- 🟡 TODAY — important but not urgent
- 🟢 CAN WAIT — delegate or batch for later
- ⚪ NOISE — Elena can handle or ignore

For each item, add one line of context connecting it to anything you know. Group and present in priority order.`,
    messages: [{ role: 'user', content: JSON.stringify(items, null, 2) }]
  });

  return response.content[0].text;
}

// Learn a preference from Corey's behavior
export async function learnPreference(key, value, learnedFrom = '') {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO preferences (key, value, learned_from, updated_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).run(key, value, learnedFrom);
}

// Auto-detect decisions and follow-ups in Elena's responses
async function detectAndLogActions(responseText) {
  try {
    const detection = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: 'Analyze this assistant response. Extract any decisions made or follow-ups mentioned. Return JSON: {"decisions": [{"summary": "...", "entities": ["name1"]}], "followups": [{"description": "...", "due": "date or null", "entity": "name or null"}]}. If none found, return {"decisions":[],"followups":[]}. JSON only.',
      messages: [{ role: 'user', content: responseText }]
    });

    let raw = detection.content[0].text.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const result = JSON.parse(raw);

    for (const d of result.decisions || []) {
      logDecision(d.summary, '', d.entities || []);
    }
    for (const f of result.followups || []) {
      addFollowup(f.description, f.due, f.entity);
    }
  } catch (err) {
    // Non-critical — don't fail the main flow
  }
}

// Search patient directory for mentions in user message
function findPatientContext(message) {
  const msgLower = message.toLowerCase();
  const matches = [];

  for (const [name, info] of Object.entries(PATIENT_DIRECTORY)) {
    const nameLower = name.toLowerCase();
    // Check first name, last name, or full name
    const parts = nameLower.split(/\s+/);
    const isMatch = parts.some(part => part.length > 2 && msgLower.includes(part)) || msgLower.includes(nameLower);

    if (isMatch) {
      const recent = info.recent_messages || [];
      const lastMsgs = recent.slice(-3).map(m =>
        m.dir + ' (' + (m.time || '').substring(0, 10) + '): ' + (m.text || '').substring(0, 150)
      ).join('\n  ');

      matches.push(
        '\n- **' + name + '** | ' + info.total_msgs + ' messages, ' + info.conversations +
        ' convos | First: ' + (info.first_contact || '?').substring(0, 10) +
        ' | Last: ' + (info.last_contact || '?').substring(0, 10) +
        '\n  Recent:\n  ' + lastMsgs
      );
    }
  }

  if (matches.length === 0) return null;
  return '\n\n## PATIENT HISTORY (from SMS records)\n' + matches.join('\n');
}
