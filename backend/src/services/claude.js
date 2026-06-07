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

// RAG imports — shared vector store with standalone Elena
let ragEmbed, ragSearch, ragKeywordSearch, ragReady;
try {
  const embeddings = await import('./embeddings.js');
  const vectorStore = await import('./vectorStore.js');
  ragEmbed = embeddings.embed;
  ragSearch = vectorStore.search;
  ragKeywordSearch = vectorStore.keywordSearch;
  ragReady = vectorStore.isReady;
} catch (err) {
  console.warn('RAG modules not available:', err.message);
  ragReady = () => false;
}

// Rules engine — shared source of truth, overrides all other context
let rulesReady, buildRulesBlock, createRule;
try {
  const rules = await import('./rules.js');
  rulesReady = rules.isRulesReady;
  buildRulesBlock = rules.buildRulesBlock;
  createRule = rules.createRule;
} catch (err) {
  console.warn('Rules module not available:', err.message);
  rulesReady = () => false;
  buildRulesBlock = async () => '';
  createRule = async () => null;
}

const anthropic = new Anthropic();

// RAG retrieval helper — shared with standalone Elena
async function getRAGContext(userMessage) {
  if (!ragReady || !ragReady()) return '';
  try {
    const queryEmbedding = await ragEmbed(userMessage);
    const semanticResults = await ragSearch(queryEmbedding, 6);
    const kwResults = await ragKeywordSearch(userMessage, 4);

    const seen = new Set();
    const allResults = [];
    for (const r of [...semanticResults, ...kwResults]) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        allResults.push(r);
      }
    }

    if (allResults.length === 0) return '';

    const top = allResults.slice(0, 8);
    let ragBlock = '\n\n## RETRIEVED CONTEXT (from shared knowledge base)\n';
    ragBlock += 'The following was retrieved as relevant from Elena\'s knowledge base:\n\n';
    for (const r of top) {
      ragBlock += `### [${r.source}]\n${r.content}\n\n`;
    }
    return ragBlock;
  } catch (err) {
    console.error('RAG retrieval error (continuing without):', err.message);
    return '';
  }
}

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

  // RULES — injected FIRST, above all other retrieved context
  // Rules are the source of truth and override everything else
  const rulesBlock = await buildRulesBlock();
  if (rulesBlock) systemPrompt += rulesBlock;

  // Add RAG context from shared vector store
  const ragContext = await getRAGContext(userMessage);
  if (ragContext) systemPrompt += ragContext;

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

  // Detect if user is setting a rule (async, non-blocking)
  detectAndCreateRule(userMessage).catch(() => {});

  return assistantMessage;
}

// One-shot Elena call — no conversation history, no DB save
export async function oneShot(prompt, systemOverride = null) {
  const learnedFacts = buildLearnedContext(prompt);
  const base = systemOverride || 'You are Elena, a warm and direct assistant for Corey, CEO of Medically Modern (a DME company). Be concise and specific.';
  let system = learnedFacts ? base + learnedFacts : base;

  // Rules — always inject into one-shot calls too
  const rulesBlock = await buildRulesBlock();
  if (rulesBlock) system += rulesBlock;

  // Add RAG for one-shot calls too
  const ragContext = await getRAGContext(prompt);
  if (ragContext) system += ragContext;

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
  } catch (err) {}
}

// Search patient directory for mentions in user message
function findPatientContext(message) {
  const msgLower = message.toLowerCase();
  const matches = [];

  for (const [name, info] of Object.entries(PATIENT_DIRECTORY)) {
    const nameLower = name.toLowerCase();
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

// Detect when user is setting a rule and auto-create it in the shared knowledge base
async function detectAndCreateRule(userMessage) {
  // Quick check — skip obvious non-rule messages
  const msgLower = userMessage.toLowerCase();
  const ruleSignals = [
    'make a rule', 'add a rule', 'create a rule', 'new rule',
    'remember that', 'from now on', 'going forward',
    'we don\'t', 'we dont', 'we no longer', 'we stopped', 'we\'ve stopped',
    'never ', 'always ', 'make sure you', 'make sure elena',
    'update your rule', 'change the rule',
    'we now ', 'we only ', 'we are now', 'we\'re now',
    'stop accepting', 'start accepting', 'we accept', 'we take',
    'we don\'t take', 'we dont take', 'we don\'t accept', 'we dont accept',
  ];
  if (!ruleSignals.some(s => msgLower.includes(s))) return;

  try {
    const detection = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: `You detect business rules in user messages. A rule is a directive that should be remembered permanently and override any previous context. Examples:
- "we don't take United" → rule: "Medically Modern does not accept United insurance."
- "from now on, always call back patients within 2 hours" → rule: "All patient callbacks must happen within 2 hours."
- "remember that we only ship on Tuesdays and Fridays" → rule: "Shipping only occurs on Tuesdays and Fridays."

If the message contains a rule, return JSON: {"isRule": true, "rule": "clear statement of the rule", "category": "insurance|shipping|policy|products|patients|operations|general"}
If NOT a rule (just a question or casual statement), return: {"isRule": false}
JSON only, no explanation.`,
      messages: [{ role: 'user', content: userMessage }]
    });

    let raw = detection.content[0].text.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const result = JSON.parse(raw);

    if (result.isRule && result.rule) {
      const created = await createRule(result.rule, result.category || 'general', {
        source_message: userMessage.substring(0, 200),
        detected_at: new Date().toISOString(),
      });
      console.log(`Rule created from chat: [${result.category}] ${result.rule} (id: ${created?.id})`);
    }
  } catch (err) {
    console.error('Rule detection error:', err.message);
  }
}
