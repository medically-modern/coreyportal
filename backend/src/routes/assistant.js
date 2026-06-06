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

// Elena's live briefing — fetches Gmail + RingCentral before generating
import { getThreads, getUnreadCount, checkConnection as gmailCheck } from '../services/gmail.js';
import { getTextConversations, getMissedCalls, checkConnection as rcCheck } from '../services/ringcentral.js';

router.post('/briefing', async (req, res) => {
  try {
    // Fetch live data from Gmail and RingCentral in parallel
    const results = await Promise.allSettled([
      gmailCheck().then(async (status) => {
        if (!status.connected) return { connected: false };
        const [threads, unreadCount] = await Promise.all([
          getThreads({ maxResults: 15 }),
          getUnreadCount()
        ]);
        return { connected: true, threads, unreadCount };
      }),
      rcCheck().then(async (status) => {
        if (!status.connected) return { connected: false };
        const [texts, missed] = await Promise.all([
          getTextConversations(30),
          getMissedCalls(10)
        ]);
        return { connected: true, texts, missed };
      }),
      // Also pull pending team questions
      (async () => {
        const db = getDb();
        const questions = db.prepare("SELECT * FROM questions WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10").all();
        return questions;
      })()
    ]);

    const gmail = results[0].status === 'fulfilled' ? results[0].value : { connected: false };
    const rc = results[1].status === 'fulfilled' ? results[1].value : { connected: false };
    const questions = results[2].status === 'fulfilled' ? results[2].value : [];

    // Build a live data summary for Elena
    let liveContext = '\n\n## LIVE DATA (just fetched — this is current right now)\n';

    // Gmail
    if (gmail.connected && gmail.threads) {
      liveContext += `\n### Email: ${gmail.unreadCount || 0} unread in inbox\n`;
      const unread = gmail.threads.filter(t => t.isUnread).slice(0, 8);
      if (unread.length > 0) {
        liveContext += 'Unread/unprocessed emails:\n';
        for (const t of unread) {
          liveContext += `- From: ${t.from} | Subject: "${t.subject}" | ${t.snippet?.substring(0, 80)}...\n`;
        }
      }
      const recent = gmail.threads.slice(0, 5);
      liveContext += 'Most recent threads:\n';
      for (const t of recent) {
        liveContext += `- ${t.isUnread ? '(UNREAD) ' : ''}${t.from}: "${t.subject}" — ${t.snippet?.substring(0, 60)}\n`;
      }
    } else {
      liveContext += '\n### Email: Not connected (Gmail OAuth needed)\n';
    }

    // RingCentral texts
    if (rc.connected && rc.texts) {
      const totalUnread = rc.texts.reduce((sum, c) => sum + (c.unread || 0), 0);
      liveContext += `\n### Texts: ${totalUnread} unread across ${rc.texts.length} conversations\n`;
      // Show conversations with unread messages
      const withUnread = rc.texts.filter(c => c.unread > 0).slice(0, 5);
      if (withUnread.length > 0) {
        liveContext += 'Unread text conversations:\n';
        for (const c of withUnread) {
          const lastMsg = c.messages[0];
          liveContext += `- ${c.contact} (${c.unread} unread): "${lastMsg?.text?.substring(0, 80) || 'no preview'}"\n`;
        }
      }
      // Most recent texts regardless
      const recentTexts = rc.texts.slice(0, 5);
      liveContext += 'Most recent texts:\n';
      for (const c of recentTexts) {
        const lastMsg = c.messages[0];
        liveContext += `- ${c.contact}: "${lastMsg?.text?.substring(0, 60) || ''}" (${lastMsg?.direction || ''}, ${lastMsg?.time || ''})\n`;
      }

      // Missed calls
      if (rc.missed && rc.missed.length > 0) {
        liveContext += `\n### Missed calls: ${rc.missed.length}\n`;
        for (const call of rc.missed.slice(0, 5)) {
          liveContext += `- ${call.from?.phoneNumber || call.from?.name || 'Unknown'} at ${call.startTime}\n`;
        }
      }
    } else {
      liveContext += '\n### Texts/Calls: Not connected\n';
    }

    // Team questions
    if (questions.length > 0) {
      liveContext += `\n### Team Questions: ${questions.length} pending\n`;
      for (const q of questions.slice(0, 5)) {
        liveContext += `- [${q.priority || 'normal'}] ${q.from_name || 'Team'}: ${q.headline || q.question?.substring(0, 60)}\n`;
      }
    }

    // Now call Elena with the live data injected
    const { chat: elenaChat } = await import('../services/claude.js');
    const briefingPrompt = `You're briefing Corey right now as he opens his portal. You have LIVE data below — use it. Be warm, calm, and direct. Start with "Hey Corey —" and then:
1. What's most PRESSING that needs his attention right now (from the live data). Be specific — name names, subjects, numbers.
2. A calm overview: how many unread emails, unread texts, pending questions, missed calls.
3. End with one clear next step he should take.
Keep it to 4-6 sentences max. No bullet points. Write like you're texting a friend who's overwhelmed. Make him feel like things are manageable.

${liveContext}`;

    const response = await elenaChat(briefingPrompt, 'dashboard-briefing');
    res.json({ briefing: response, sources: { gmail: gmail.connected, ringcentral: rc.connected, questions: questions.length } });
  } catch (err) {
    console.error('Briefing error:', err);
    res.status(500).json({ error: 'Briefing failed', fallback: "Hey Corey — I'm having trouble pulling your latest data, but your portal tiles below are loaded. Take a look and I'll catch up in a sec." });
  }
});
