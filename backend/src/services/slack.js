import { WebClient } from '@slack/web-api';

let slackClient = null;

function getSlack() {
  if (slackClient) return slackClient;
  if (!process.env.SLACK_BOT_TOKEN) throw new Error('Slack not configured — SLACK_BOT_TOKEN missing');
  slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
  return slackClient;
}

export async function checkConnection() {
  try {
    const slack = getSlack();
    const auth = await slack.auth.test();
    return { connected: true, team: auth.team, user: auth.user, bot_id: auth.bot_id };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// List channels the bot can see
export async function getChannels() {
  const slack = getSlack();
  const result = await slack.conversations.list({
    types: 'public_channel,private_channel',
    exclude_archived: true,
    limit: 100
  });
  return result.channels.map(c => ({
    id: c.id,
    name: c.name,
    topic: c.topic?.value || '',
    memberCount: c.num_members,
    isPrivate: c.is_private
  }));
}

// Get recent messages from a channel
export async function getChannelMessages(channelId, limit = 30) {
  const slack = getSlack();
  const result = await slack.conversations.history({ channel: channelId, limit });

  // Resolve user names
  const userCache = {};
  const resolveUser = async (userId) => {
    if (userCache[userId]) return userCache[userId];
    try {
      const info = await slack.users.info({ user: userId });
      userCache[userId] = info.user.real_name || info.user.name;
    } catch {
      userCache[userId] = userId;
    }
    return userCache[userId];
  };

  const messages = await Promise.all(
    result.messages.map(async (m) => ({
      ts: m.ts,
      user: m.user ? await resolveUser(m.user) : 'bot',
      text: m.text,
      threadTs: m.thread_ts,
      replyCount: m.reply_count || 0,
      reactions: m.reactions?.map(r => ({ name: r.name, count: r.count })) || [],
      timestamp: new Date(parseFloat(m.ts) * 1000).toISOString()
    }))
  );

  return messages;
}

// Get thread replies
export async function getThreadReplies(channelId, threadTs) {
  const slack = getSlack();
  const result = await slack.conversations.replies({ channel: channelId, ts: threadTs });

  const userCache = {};
  const resolveUser = async (userId) => {
    if (userCache[userId]) return userCache[userId];
    try {
      const info = await slack.users.info({ user: userId });
      userCache[userId] = info.user.real_name || info.user.name;
    } catch {
      userCache[userId] = userId;
    }
    return userCache[userId];
  };

  return Promise.all(
    result.messages.map(async (m) => ({
      ts: m.ts,
      user: m.user ? await resolveUser(m.user) : 'bot',
      text: m.text,
      timestamp: new Date(parseFloat(m.ts) * 1000).toISOString()
    }))
  );
}

// Search messages across workspace
export async function searchMessages(query, limit = 20) {
  // Note: search requires user token, not bot token
  // Using conversations.history with filtering as fallback
  const slack = getSlack();
  const channels = await getChannels();

  const results = [];
  for (const ch of channels.slice(0, 10)) {
    try {
      const msgs = await slack.conversations.history({ channel: ch.id, limit: 50 });
      const matches = msgs.messages.filter(m =>
        m.text && m.text.toLowerCase().includes(query.toLowerCase())
      );
      for (const m of matches.slice(0, 5)) {
        results.push({
          channel: ch.name,
          channelId: ch.id,
          text: m.text,
          user: m.user,
          ts: m.ts,
          timestamp: new Date(parseFloat(m.ts) * 1000).toISOString()
        });
      }
    } catch {
      // Bot may not be in this channel
    }
    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}

// Get DMs (direct messages to the bot)
export async function getDMs(limit = 20) {
  const slack = getSlack();
  const convos = await slack.conversations.list({ types: 'im', limit: 20 });

  const messages = [];
  for (const dm of convos.channels || []) {
    try {
      const history = await slack.conversations.history({ channel: dm.id, limit: 5 });
      for (const m of history.messages) {
        messages.push({
          channelId: dm.id,
          userId: dm.user,
          text: m.text,
          ts: m.ts,
          timestamp: new Date(parseFloat(m.ts) * 1000).toISOString()
        });
      }
    } catch {
      // May not have access
    }
  }

  return messages.slice(0, limit);
}

// Post a message to a channel
export async function postMessage(channelId, text, threadTs = null) {
  const slack = getSlack();
  const params = { channel: channelId, text };
  if (threadTs) params.thread_ts = threadTs;
  return slack.chat.postMessage(params);
}
