import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const pendingQuestions = db.prepare("SELECT COUNT(*) as count FROM questions WHERE status = 'pending'").get().count;

  // TODO: Pull real data from Gmail, RC, Slack APIs
  res.json({
    stats: {
      unreadEmails: 0,       // TODO: Gmail API
      pendingQuestions,
      missedCalls: 0,        // TODO: RingCentral API
      unrepliedTexts: 0,     // TODO: RingCentral API
      urgentItems: 0,        // TODO: computed from all sources
    },
    priorityFeed: [],        // TODO: aggregated + triaged items
  });
});

export default router;
