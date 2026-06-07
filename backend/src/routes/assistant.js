import { Router } from 'express';
import { chat } from '../services/claude.js';
import { getRecentDecisions, getPendingFollowups, searchEntities } from '../services/context.js';
import { getDb } from '../db/init.js';
import { getThreads, getUnreadCount, checkConnection as gmailCheck } from '../services/gmail.js';
import { getTextConversations, getMissedCalls, checkConnection as rcCheck } from '../services/ringcentral.js';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const result = await chat(message, context);
    res.json({ response: result });
  } catch (err) {
    console.error('Assistant error:', err);
    res.status(500).json({ error: 'Assistant unavailable' });
  }
});

router.get('/history', (req, res) => {
  try {
    const db = getDb();
    const history = db.prepare(
      'SELECT role, content, context_module, created_at FROM conversations ORDER BY created_at DESC LIMIT 50'
    ).all().reverse();
    res.json({ messages: history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// Elena's follow-ups
router.get('/followups', (req, res) => {
  try {
    const followups = getPendingFollowups();
    res.json({ followups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Elena's recent decisions
router.get('/decisions', (req, res) => {
  try {
    const decisions = getRecentDecisions(10);
    res.json({ decisions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint — returns raw RC + Monday data for a phone number (no Claude call)
router.get('/debug-focus', async (req, res) => {
  const phone = req.query.phone || '';
  const debug = { phone, steps: [] };

  // Step 1: Full conversation lookup (paginates through ALL RC messages, client-side phone match)
  try {
    const { getFullConversation } = await import('../services/ringcentral.js');
    const msgs = await getFullConversation(phone, 180);
    debug.steps.push({
      step: 'RC full conversation (180 days)',
      totalMessages: msgs.length,
      oldestMessage: msgs[0]?.time || null,
      newestMessage: msgs[msgs.length - 1]?.time || null,
      recentMessages: msgs.slice(-5),
    });
  } catch (e) {
    debug.steps.push({ step: 'RC full conversation', error: e.message });
  }

  // Step 3: Monday.com search
  try {
    const { searchMondayPatient } = await import('./monday.js');
    const results = await searchMondayPatient(phone);
    debug.steps.push({ step: 'Monday search', results: results || [] });
  } catch (e) {
    debug.steps.push({ step: 'Monday search', error: e.message });
  }

  res.json(debug);
});

// Focus context — Elena analyzes a single item with REAL conversation history
router.post('/focus-context', async (req, res) => {
  try {
    const { item } = req.body;
    if (!item) return res.status(400).json({ error: 'item required' });

    let conversationHistory = '';
    let patientName = '';

    // Pull real conversation history based on channel
    if (item.channel === 'rc' && item.from) {
      try {
        const { getFullConversation } = await import('../services/ringcentral.js');
        const phone = /^\+?\d/.test(item.from) ? item.from : null;
        console.log(`[focus-context] RC full conversation lookup for: ${phone}`);
        if (phone) {
          const messages = await getFullConversation(phone, 180);
          console.log(`[focus-context] Found ${messages.length} total messages for ${phone}`);

          if (messages.length > 0) {
            // Show most recent 30 messages (chronological — oldest to newest)
            const recent = messages.slice(-30);
            conversationHistory = `\n\nFULL SMS CONVERSATION HISTORY (${messages.length} total messages, showing last ${recent.length}):\n`;
            for (const msg of recent) {
              const dir = msg.direction === 'Inbound' ? 'THEM' : 'US';
              conversationHistory += `[${dir}] ${msg.text} (${msg.time})\n`;
            }
            // Extract patient name from outbound messages
            for (const msg of messages) {
              if (msg.direction === 'Outbound' && msg.text) {
                const nameMatch = msg.text.match(/^(?:Hey|Dear|Hi)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
                if (nameMatch) {
                  patientName = nameMatch[1];
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('RC context fetch error:', e.message);
      }
    } else if (item.channel === 'email' && item.threadId) {
      try {
        const { getThread } = await import('../services/gmail.js');
        const thread = await getThread(item.threadId);
        if (thread && thread.messages) {
          conversationHistory = '\n\nFULL EMAIL THREAD:\n';
          for (const msg of thread.messages) {
            conversationHistory += `From: ${msg.from} | Subject: ${msg.subject}\n${msg.body?.substring(0, 500) || ''}\n---\n`;
          }
        }
      } catch (e) {
        console.error('Gmail context fetch error:', e.message);
      }
    }

    // Check entities DB for additional context
    let entityContext = '';
    const searchTerm = patientName || item.from || '';
    if (searchTerm) {
      try {
        const entities = searchEntities(searchTerm);
        if (entities && entities.length > 0) {
          entityContext = '\n\nKNOWN ENTITY INFO:\n';
          for (const e of entities) {
            entityContext += `${e.name}: ${e.details || e.type || ''}\n`;
          }
        }
      } catch {}
    }

    // Monday.com patient lookup — only for RC texts (not emails)
    let mondayContext = '';
    let mondayTimedOut = false;
    let mondaySearched = false;
    const isTextChannel = item.channel === 'rc';

    if (isTextChannel) {
      try {
        const { searchMondayPatient } = await import('./monday.js');
        const mondayQuery = item.from || patientName || '';
        if (mondayQuery) {
          mondaySearched = true;
          const mondayResults = await Promise.race([
            searchMondayPatient(mondayQuery),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Monday search timeout')), 8000))
          ]);
          if (mondayResults && mondayResults.length > 0) {
            mondayContext = '\n\nMONDAY.COM PATIENT RECORDS:\n';
            for (const r of mondayResults.slice(0, 3)) {
              mondayContext += `Patient: ${r.name} | Board: ${r.board} | Stage: ${r.group}\n`;
              const cols = Object.entries(r.columns || {}).slice(0, 8);
              if (cols.length > 0) {
                mondayContext += `  Details: ${cols.map(([k, v]) => `${k}: ${v}`).join(' | ')}\n`;
              }
            }
            if (!patientName && mondayResults[0]?.name) {
              patientName = mondayResults[0].name;
            }
          } else {
            mondayContext = '\n\n⚠️ MONDAY.COM: Patient NOT FOUND on any board. This may need follow-up.\n';
          }
        }
      } catch (e) {
        if (e.message === 'Monday search timeout') {
          mondayTimedOut = true;
          mondayContext = '\n\n⚠️ MONDAY.COM: Search timed out — could not verify patient records.\n';
          console.warn('[focus-context] Monday search timed out after 8s');
        } else {
          console.error('Monday patient lookup error:', e.message);
          mondayContext = '\n\n⚠️ MONDAY.COM: Search failed — could not verify patient records.\n';
        }
      }
    }

    // Build data-availability flags for Elena
    const hasConversationHistory = conversationHistory.length > 0;
    const hasMondayData = mondayContext.includes('Patient:');

    const { oneShot } = await import('../services/claude.js');

    // Channel-specific prompts
    let prompt;
    if (isTextChannel) {
      // ── TEXT/RC prompt: patient-focused ──
      prompt = `You're Elena, Corey's ADHD-friendly assistant. Corey is looking at a TEXT MESSAGE in his focus queue.

## ABSOLUTE RULES
1. You may ONLY reference information explicitly provided below.
2. If there is NO conversation history, say "I couldn't pull the conversation history for this number."
3. If Monday.com shows NOT FOUND or timed out, flag it.
4. NEVER invent or guess who someone is or what they want.

## DATA AVAILABILITY
- Conversation history: ${hasConversationHistory ? 'YES — loaded below' : 'NO — could not retrieve'}
- Monday.com records: ${hasMondayData ? 'YES — found below' : mondayTimedOut ? 'TIMED OUT' : mondaySearched ? 'NOT FOUND on any board' : 'Not searched'}
${patientName ? `- Patient name found: ${patientName}` : '- Patient name: NOT IDENTIFIED'}

## ITEM
Channel: Text/SMS
From: ${item.from || 'Unknown'}
Text: ${item.text || ''}
Time: ${item.time || ''}
${conversationHistory}${entityContext}${mondayContext}

## RESPONSE FORMAT — STRICT JSON ONLY
Return ONLY a JSON object with these exact keys, no markdown, no explanation:
{
  "summary": "1 sentence: what this is about (use patient name if found)",
  "action": "1 sentence: exactly what Corey should do next",
  "urgency": "do_now" or "today" or "can_wait",
  "flags": ["array of short warning strings, e.g. 'Not found on Monday.com boards'"]
}

${!hasConversationHistory ? 'Add "Couldn\'t pull conversation history" to flags array.' : ''}
${mondaySearched && !hasMondayData ? 'Add "Not found on Monday.com boards" to flags array.' : ''}
Return ONLY the JSON object. No markdown fences, no explanation.`;
    } else {
      // ── EMAIL prompt: business-context-aware ──
      prompt = `You're Elena, Corey's ADHD-friendly assistant. Corey is looking at an EMAIL in his focus queue.

## RULES
1. ONLY reference information provided below. NEVER invent context.
2. Classify the email type: vendor/invoice, patient communication, internal, marketing/spam, regulatory, or other.
3. For vendor/invoice emails: summarize what's owed, to whom, and any deadline. Do NOT look up names as patients.
4. For patient emails: note who it's from and what they need.
5. For marketing/spam: tell Corey he can skip it.

## ITEM
From: ${item.from || 'Unknown'}
Subject: ${item.subject || ''}
Preview: ${item.text || ''}
Time: ${item.time || ''}
${conversationHistory}${entityContext}

## RESPONSE FORMAT — STRICT JSON ONLY
Return ONLY a JSON object with these exact keys, no markdown, no explanation:
{
  "type": "vendor/invoice" or "patient" or "internal" or "spam" or "regulatory" or "other",
  "summary": "1 sentence: what this email is about",
  "action": "1 sentence: what Corey should do",
  "urgency": "do_now" or "today" or "can_wait",
  "flags": []
}
Return ONLY the JSON object. No markdown fences, no explanation.`;
    }

    const raw = await oneShot(prompt);
    // Parse structured JSON from Elena
    let parsed;
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: return as plain text if JSON parsing fails
      parsed = { summary: raw, action: '', urgency: 'today', flags: [] };
    }
    // Normalize urgency
    const urgency = (parsed.urgency || 'today').toLowerCase().replace(/\s+/g, '_');
    res.json({
      context: parsed.summary || raw, // backwards compat
      structured: {
        summary: parsed.summary || '',
        action: parsed.action || '',
        urgency: ['do_now', 'today', 'can_wait'].includes(urgency) ? urgency : 'today',
        type: parsed.type || (isTextChannel ? 'patient' : 'email'),
        flags: parsed.flags || [],
      }
    });
  } catch (err) {
    console.error('Focus context error:', err);
    res.status(500).json({ error: 'Context unavailable' });
  }
});

// Elena drafts a reply for Corey
router.post('/draft-reply', async (req, res) => {
  try {
    const { channel, originalText, from, subject, conversationHistory } = req.body;
    if (!originalText) return res.status(400).json({ error: 'originalText required' });

    const { draftResponse } = await import('../services/claude.js');

    // Build context for the draft
    let fullContext = '';
    if (conversationHistory) {
      fullContext += `Recent conversation:\n${conversationHistory}\n\n`;
    }
    fullContext += `Latest message from ${from || 'contact'}:\n`;
    if (subject) fullContext += `Subject: ${subject}\n`;
    fullContext += originalText;

    const draft = await draftResponse(fullContext, channel || 'email');
    res.json({ draft });
  } catch (err) {
    console.error('Draft reply error:', err);
    res.status(500).json({ error: 'Failed to draft reply' });
  }
});

// Elena's live briefing — fetches ALL unread Gmail (30 days) + RC texts (3 days) before generating
router.post('/briefing', async (req, res) => {
  try {
    // Fetch live data from Gmail and RingCentral in parallel
    const results = await Promise.allSettled([
      gmailCheck().then(async (status) => {
        if (!status.connected) return { connected: false };
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateStr = thirtyDaysAgo.toISOString().split('T')[0].replace(/-/g, '/');
        const [unreadThreads, allRecent, unreadCount] = await Promise.all([
          getThreads({ maxResults: 200, q: `is:unread after:${dateStr}` }),
          getThreads({ maxResults: 20 }),
          getUnreadCount()
        ]);
        return { connected: true, unreadThreads, allRecent, unreadCount };
      }),
      rcCheck().then(async (status) => {
        if (!status.connected) return { connected: false };
        const [texts, missed] = await Promise.all([
          getTextConversations(250, 3),
          getMissedCalls(20)
        ]);
        return { connected: true, texts, missed };
      }),
      (async () => {
        const db = getDb();
        const questions = db.prepare("SELECT * FROM questions WHERE status = 'pending' ORDER BY created_at DESC").all();
        return questions;
      })()
    ]);

    const gmail = results[0].status === 'fulfilled' ? results[0].value : { connected: false };
    const rc = results[1].status === 'fulfilled' ? results[1].value : { connected: false };
    const questions = results[2].status === 'fulfilled' ? results[2].value : [];

    // ── Resolve phone numbers to patient names via Monday.com ──
    const { searchMondayPatient } = await import('./monday.js');
    const phoneNameCache = {}; // cache to avoid duplicate lookups

    async function resolvePhone(phone) {
      if (!phone || !/^\+?\d/.test(phone)) return phone;
      const digits = phone.replace(/\D/g, '');
      if (phoneNameCache[digits]) return phoneNameCache[digits];
      try {
        const results = await searchMondayPatient(phone);
        if (results && results.length > 0) {
          const name = results[0].name;
          const stage = results[0].group || results[0].board || '';
          const resolved = `${name} (${phone})${stage ? ' [' + stage + ']' : ''}`;
          phoneNameCache[digits] = resolved;
          return resolved;
        }
      } catch {}
      phoneNameCache[digits] = phone;
      return phone;
    }

    // Also try extracting patient name from outbound messages in a conversation
    function extractNameFromConvo(messages) {
      for (const msg of messages || []) {
        if (msg.direction === 'Outbound' && msg.text) {
          const m = msg.text.match(/^(?:Hey|Dear|Hi)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
          if (m) return m[1];
        }
      }
      return null;
    }

    // Resolve all unique phone numbers from RC data in parallel
    if (rc.connected) {
      const allPhones = new Set();
      for (const c of rc.texts || []) {
        if (/^\+?\d/.test(c.contact)) allPhones.add(c.contact);
      }
      for (const call of rc.missed || []) {
        const p = call.from?.phoneNumber;
        if (p) allPhones.add(p);
      }
      // Batch lookup — up to 20 at a time to avoid hammering Monday
      const phonesToResolve = [...allPhones].slice(0, 40);
      await Promise.allSettled(phonesToResolve.map(p => resolvePhone(p)));
    }

    // Build a live data summary for Elena
    let liveContext = '\n\n## LIVE DATA (just fetched)\n';
    liveContext += 'IMPORTANT: "unread" means "unprocessed" — Corey uses read/unread status to track what he\'s handled.\n';
    liveContext += 'Phone numbers below have been looked up in Monday.com. If a name appears, that IS the patient.\n';

    if (gmail.connected) {
      const unread = gmail.unreadThreads || [];
      liveContext += `\n### Email: ${gmail.unreadCount || unread.length} unprocessed emails (past 30 days)\n`;
      if (unread.length > 0) {
        liveContext += `All unprocessed emails (${unread.length} total):\n`;
        for (const t of unread) {
          liveContext += `- From: ${t.from} | Subject: "${t.subject}" | Preview: ${t.snippet?.substring(0, 100)} | Date: ${t.date}\n`;
        }
      } else {
        liveContext += 'Inbox zero on unprocessed.\n';
      }
      if (gmail.allRecent && gmail.allRecent.length > 0) {
        liveContext += '\nMost recent threads (for context):\n';
        for (const t of gmail.allRecent.slice(0, 10)) {
          liveContext += `- ${t.isUnread ? 'UNPROCESSED ' : ''}${t.from}: "${t.subject}" (${t.date})\n`;
        }
      }
    } else {
      liveContext += '\n### Email: Not connected (Gmail OAuth needed)\n';
    }

    if (rc.connected && rc.texts) {
      const sorted = [...rc.texts].sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1;
        if (a.unread === 0 && b.unread > 0) return 1;
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      });

      const totalUnread = sorted.reduce((sum, c) => sum + (c.unread || 0), 0);
      const unreadConvos = sorted.filter(c => c.unread > 0);
      liveContext += `\n### Texts (past 3 days): ${totalUnread} unread across ${unreadConvos.length} conversations\n`;

      if (unreadConvos.length > 0) {
        liveContext += '\nUNREAD (needs attention):\n';
        for (const c of unreadConvos) {
          // Use resolved name from Monday, or extract from outbound msgs, or raw number
          const name = phoneNameCache[c.contact?.replace(/\D/g, '')] || extractNameFromConvo(c.messages) || c.contact;
          liveContext += `- ${name} (${c.unread} unread):\n`;
          for (const msg of c.messages.slice(0, 3)) {
            liveContext += `    ${msg.direction === 'Inbound' ? '<- ' : '-> '}"${msg.text?.substring(0, 100) || ''}" (${msg.time})\n`;
          }
        }
      }

      const readConvos = sorted.filter(c => c.unread === 0);
      if (readConvos.length > 0) {
        liveContext += `\nAlready handled (${readConvos.length} conversations):\n`;
        for (const c of readConvos.slice(0, 10)) {
          const lastMsg = c.messages[0];
          const name = phoneNameCache[c.contact?.replace(/\D/g, '')] || extractNameFromConvo(c.messages) || c.contact;
          liveContext += `- ${name}: "${lastMsg?.text?.substring(0, 60) || ''}" (${lastMsg?.direction || ''})\n`;
        }
      }

      if (rc.missed && rc.missed.length > 0) {
        liveContext += `\n### Missed calls: ${rc.missed.length}\n`;
        liveContext += 'IMPORTANT: These are real patients calling from their phones. Every number is a patient — look up by the resolved name.\n';
        for (const call of rc.missed) {
          const rawPhone = call.from?.phoneNumber || call.from?.name || 'Unknown';
          const name = phoneNameCache[rawPhone.replace(/\D/g, '')] || rawPhone;
          liveContext += `- ${name} at ${call.startTime}\n`;
        }
      }
    } else {
      liveContext += '\n### Texts/Calls: Not connected\n';
    }

    if (questions.length > 0) {
      liveContext += `\n### Team Questions: ${questions.length} pending\n`;
      for (const q of questions) {
        liveContext += `- [${q.priority || 'normal'}] ${q.from_name || 'Team'}: ${q.headline || q.question?.substring(0, 80)} (submitted ${q.created_at})\n`;
      }
    }

    const { oneShot } = await import('../services/claude.js');
    const briefingPrompt = `You're briefing Corey right now as he opens his portal. You have LIVE data below.

## INSTRUCTIONS
Analyze ALL the data and produce a structured briefing. Be warm, specific, and direct.

## RESPONSE FORMAT — STRICT JSON ONLY
Return ONLY a JSON object with these exact keys:
{
  "greeting": "Short warm greeting, 1 sentence max (e.g. 'Hey Corey — busy morning, let me catch you up.')",
  "urgent": [
    {"label": "short description of urgent item", "detail": "1 sentence context/action"}
  ],
  "overview": {
    "emails": number or 0,
    "texts": number or 0,
    "missed_calls": number or 0,
    "team_questions": number or 0
  },
  "items": [
    {"label": "person or subject", "detail": "what they need / what it's about", "type": "email|text|call|question"}
  ],
  "next_step": "1 sentence: the single most important thing Corey should do first and why"
}

Rules:
- "urgent" = things that need action RIGHT NOW. Max 2 items. Empty array if nothing urgent.
- "items" = everything else worth mentioning, sorted by priority. Max 6 items.
- Use real names and subjects from the data. Never invent.
- If you know something from your memory about a patient or product, factor it in.

Return ONLY the JSON object. No markdown fences, no explanation.

${liveContext}`;

    const raw = await oneShot(briefingPrompt);
    let parsed;
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }

    res.json({
      briefing: parsed ? null : raw,
      structured: parsed ? {
        greeting: parsed.greeting || '',
        urgent: parsed.urgent || [],
        overview: parsed.overview || {},
        items: parsed.items || [],
        next_step: parsed.next_step || '',
      } : null,
      sources: { gmail: gmail.connected, ringcentral: rc.connected, questions: questions.length }
    });
  } catch (err) {
    console.error('Briefing error:', err);
    res.status(500).json({ error: 'Briefing failed', fallback: "Hey Corey - having trouble pulling your latest data, but your portal tiles below are loaded. Take a look and I'll catch up in a sec." });
  }
});

export default router;
