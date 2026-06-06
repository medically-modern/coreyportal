import { Router } from 'express';
import { chat } from '../services/claude.js';
import { getRecentDecisions, getPendingFollowups, searchEntities } from '../services/context.js';
import { getDb } from '../db/init.js';

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

export default router;

// Elena's live briefing — fetches ALL unread Gmail (30 days) + RC texts (3 days) before generating
import { getThreads, getUnreadCount, checkConnection as gmailCheck } from '../services/gmail.js';
import { getTextConversations, getMissedCalls, checkConnection as rcCheck } from '../services/ringcentral.js';

router.post('/briefing', async (req, res) => {
  try {
    // Fetch live data from Gmail and RingCentral in parallel
    const results = await Promise.allSettled([
      gmailCheck().then(async (status) => {
        if (!status.connected) return { connected: false };
        // Pull ALL unread emails from past 30 days — unread = unprocessed for Corey
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
        // Pull ALL text conversations from past 3 days
        const [texts, missed] = await Promise.all([
          getTextConversations(250, 3),
          getMissedCalls(20)
        ]);
        return { connected: true, texts, missed };
      }),
      // Also pull pending team questions
      (async () => {
        const db = getDb();
        const questions = db.prepare("SELECT * FROM questions WHERE status = 'pending' ORDER BY created_at DESC").all();
        return questions;
      })()
    ]);

    const gmail = results[0].status === 'fulfilled' ? results[0].value : { connected: false };
    const rc = results[1].status === 'fulfilled' ? results[1].value : { connected: false };
    const questions = results[2].status === 'fulfilled' ? results[2].value : [];

    // Build a live data summary for Elena
    let liveContext = '\n\n## LIVE DATA (just fetched — this is current right now)\n';
    liveContext += 'IMPORTANT: "unread" means "unprocessed" — Corey uses read/unread status to track what he\'s handled. Unread items are his to-do list.\n';

    // Gmail — ALL unread from past 30 days
    if (gmail.connected) {
      const unread = gmail.unreadThreads || [];
      liveContext += `\n### Email: ${gmail.unreadCount || unread.length} unprocessed emails (past 30 days)\n`;
      if (unread.length > 0) {
        liveContext += `All unprocessed emails (${unread.length} total):\n`;
        for (const t of unread) {
          liveContext += `- From: ${t.from} | Subject: "${t.subject}" | Preview: ${t.snippet?.substring(0, 100)} | Date: ${t.date}\n`;
        }
      } else {
        liveContext += 'Inbox zero on unprocessed — everything\'s been handled.\n';
      }
      // Also show most recent for general awareness
      if (gmail.allRecent && gmail.allRecent.length > 0) {
        liveContext += '\nMost recent threads (for context):\n';
        for (const t of gmail.allRecent.slice(0, 10)) {
          liveContext += `- ${t.isUnread ? '⬤ UNPROCESSED ' : ''}${t.from}: "${t.subject}" (${t.date})\n`;
        }
      }
    } else {
      liveContext += '\n### Email: Not connected (Gmail OAuth needed)\n';
    }

    // RingCentral — ALL texts from past 3 days, unread first
    if (rc.connected && rc.texts) {
      // Sort: unread conversations first, then by recency
      const sorted = [...rc.texts].sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1;
        if (a.unread === 0 && b.unread > 0) return 1;
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      });

      const totalUnread = sorted.reduce((sum, c) => sum + (c.unread || 0), 0);
      const unreadConvos = sorted.filter(c => c.unread > 0);
      liveContext += `\n### Texts (past 3 days): ${totalUnread} unread messages across ${unreadConvos.length} conversations — THESE NEED ATTENTION\n`;

      // Show ALL unread conversations with full detail
      if (unreadConvos.length > 0) {
        liveContext += '\nUNREAD (needs Corey\'s attention):\n';
        for (const c of unreadConvos) {
          liveContext += `- 🔴 ${c.contact} (${c.unread} unread):\n`;
          // Show last few messages for context
          for (const msg of c.messages.slice(0, 3)) {
            liveContext += `    ${msg.direction === 'Inbound' ? '← ' : '→ '}"${msg.text?.substring(0, 100) || ''}" (${msg.time})\n`;
          }
        }
      }

      // Then show read conversations for awareness
      const readConvos = sorted.filter(c => c.unread === 0);
      if (readConvos.length > 0) {
        liveContext += `\nAlready handled (${readConvos.length} conversations):\n`;
        for (const c of readConvos.slice(0, 10)) {
          const lastMsg = c.messages[0];
          liveContext += `- ${c.contact}: "${lastMsg?.text?.substring(0, 60) || ''}" (${lastMsg?.direction || ''})\n`;
        }
      }

      // Missed calls
      if (rc.missed && rc.missed.length > 0) {
        liveContext += `\n### Missed calls: ${rc.missed.length}\n`;
        for (const call of rc.missed) {
          liveContext += `- ${call.from?.phoneNumber || call.from?.name || 'Unknown'} at ${call.startTime}\n`;
        }
      }
    } else {
      liveContext += '\n### Texts/Calls: Not connected\n';
    }

    // Team questions — ALL pending
    if (questions.length > 0) {
      liveContext += `\n### Team Questions: ${questions.length} pending\n`;
      for (const q of questions) {
        liveContext += `- [${q.priority || 'normal'}] ${q.from_name || 'Team'}: ${q.headline || q.question?.substring(0, 80)} (submitted ${q.created_at})\n`;
      }
    }

    // Now call Elena with the live data injected
    const { chat: elenaChat } = await import('../services/claude.js');
    const briefingPrompt = `You're briefing Corey right now as he opens his portal. You have LIVE data below — use it. Be warm, calm, and direct. Start with "Hey Corey —" and then:
1. What's most PRESSING — unread emails and unread texts ARE his to-do list. Lead with those. Be specific — name names, subjects, numbers.
2. A calm overview: total unprocessed emails, unread texts needing attention, pending team questions, missed calls.
3. End with one clear next step he should take.
Keep it to 4-6 sentences max. No bullet points. Write like you're texting a friend who's overwhelmed. Make him feel like things are manageable.

${liveContext}`;

    const response = await elenaChat(briefingPrompt, 'dashboard-briefing');
    res.json({ briefing: response, sources: { gmail: gmail.connected, ringcentral: rc.connected, questions: questions.length } });
  } catch (err) {
    console.error('Briefing error:', err);
    res.status(500).json({ error: 'Briefing failed', fallback: "Hey Corey — I\'m having trouble pulling your latest data, but your portal tiles below are loaded. Take a look and I\'ll catch up in a sec." });
  }
});

// Elena quick-context for a single focus item
router.post('/focus-context', async (req, res) => {
  try {
    const { item } = req.body;
    if (!item) return res.status(400).json({ error: 'item required' });

    const { chat: elenaChat } = await import('../services/claude.js');
    const prompt = `You're Elena, Corey's ADHD-friendly assistant. Corey is looking at one item in his focus queue. Give him:
1. A one-sentence summary of what this is about (CONTEXT — who, what, why it matters)
2. A suggested next action (be specific: "Reply with...", "Call back about...", "Delegate to...")

Be warm, concise — 2-3 sentences max. No bullet points. Write like a trusted assistant whispering in his ear.

The item:
- Channel: ${item.channel}
- From: ${item.from || 'Unknown'}
- Subject: ${item.subject || ''}
- Content: ${item.text || ''}
- Time: ${item.time || 'Unknown'}
- Urgent: ${item.urgent ? 'Yes' : 'No'}`;

    const response = await elenaChat(prompt, 'focus-context');
    res.json({ context: response });
  } catch (err) {
    console.error('Focus context error:', err);
    res.status(500).json({ error: 'Context unavailable' });
  }
});
