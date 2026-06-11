import { google } from 'googleapis';
import { getDb } from '../db/init.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
];

let oauth2Client = null;

function getOAuth2Client() {
  if (oauth2Client) return oauth2Client;
  
  oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://corey-portal-api-production.up.railway.app/api/gmail/oauth/callback'
  );

  // Load stored tokens if they exist
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gmail_tokens');
  if (row) {
    const tokens = JSON.parse(row.value);
    oauth2Client.setCredentials(tokens);
    
    // Auto-refresh handler
    oauth2Client.on('tokens', (newTokens) => {
      const merged = { ...tokens, ...newTokens };
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('gmail_tokens', JSON.stringify(merged));
    });
  }

  return oauth2Client;
}

export function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  });
}

export async function handleCallback(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('gmail_tokens', JSON.stringify(tokens));

  return tokens;
}

function getGmail() {
  const auth = getOAuth2Client();
  if (!auth.credentials || !auth.credentials.access_token) {
    throw new Error('Gmail not authorized. Visit /api/gmail/auth to connect.');
  }
  return google.gmail({ version: 'v1', auth });
}

export async function checkConnection() {
  try {
    const gmail = getGmail();
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return { connected: true, email: profile.data.emailAddress, messagesTotal: profile.data.messagesTotal };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

export async function getThreads({ maxResults = 20, q = '', labelIds = ['INBOX'], pageToken = null } = {}) {
  const gmail = getGmail();

  const params = { userId: 'me', maxResults, labelIds };
  if (q) params.q = q;
  if (pageToken) params.pageToken = pageToken;

  const res = await gmail.users.threads.list(params);
  const threads = res.data.threads || [];

  // Fetch details for each thread
  const detailed = await Promise.all(
    threads.map(async (t) => {
      const thread = await gmail.users.threads.get({ userId: 'me', id: t.id, format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Date'] });
      const firstMsg = thread.data.messages[0];
      const lastMsg = thread.data.messages[thread.data.messages.length - 1];
      
      const getHeader = (msg, name) => {
        const h = msg.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return h ? h.value : '';
      };

      return {
        id: t.id,
        snippet: t.snippet,
        messageCount: thread.data.messages.length,
        subject: getHeader(firstMsg, 'Subject'),
        from: getHeader(lastMsg, 'From'),
        date: getHeader(lastMsg, 'Date'),
        labels: firstMsg.labelIds || [],
        isUnread: firstMsg.labelIds?.includes('UNREAD') || false
      };
    })
  );

  return { threads: detailed, nextPageToken: res.data.nextPageToken || null };
}

// Walk a MIME tree and pull out the html + plain-text bodies (handles
// nested multipart/alternative, multipart/related, etc.)
function extractBodies(payload) {
  let html = null;
  let text = null;
  const decode = (data) => Buffer.from(data, 'base64').toString('utf-8');

  function walk(part) {
    if (!part) return;
    if (!html && part.mimeType === 'text/html' && part.body?.data) {
      html = decode(part.body.data);
    } else if (!text && part.mimeType === 'text/plain' && part.body?.data) {
      text = decode(part.body.data);
    }
    for (const p of part.parts || []) walk(p);
  }
  walk(payload);

  // Single-part messages: body lives directly on the payload
  if (!html && !text && payload?.body?.data) {
    const decoded = decode(payload.body.data);
    if ((payload.mimeType || '').includes('html')) html = decoded;
    else text = decoded;
  }
  return { html, text };
}

export async function getThread(threadId) {
  const gmail = getGmail();
  const thread = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });

  const messages = thread.data.messages.map(msg => {
    const getHeader = (name) => {
      const h = msg.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return h ? h.value : '';
    };

    const { html, text } = extractBodies(msg.payload);

    // Plain text fallback (also used by Elena for summaries)
    const source = text || html || '';
    const plainBody = source.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

    return {
      id: msg.id,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      body: plainBody.substring(0, 5000), // cap at 5k chars
      bodyHtml: html ? html.substring(0, 500000) : null, // the REAL email, as sent
      labels: msg.labelIds || [],
      isUnread: msg.labelIds?.includes('UNREAD') || false
    };
  });

  return { id: threadId, messages };
}

export async function markAsRead(threadId) {
  const gmail = getGmail();
  await gmail.users.threads.modify({
    userId: 'me',
    id: threadId,
    requestBody: { removeLabelIds: ['UNREAD'] }
  });
}

export async function getUnreadCount() {
  const gmail = getGmail();
  const res = await gmail.users.labels.get({ userId: 'me', id: 'INBOX' });
  return { unread: res.data.messagesUnread, total: res.data.messagesTotal };
}

export async function searchEmails(query, maxResults = 10) {
  return getThreads({ maxResults, q: query });
}

// Send a reply to an existing thread
export async function sendReply({ threadId, to, subject, body, inReplyTo, references }) {
  const gmail = getGmail();

  // Get profile for "from" address
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const from = profile.data.emailAddress;

  // Build RFC 2822 email
  const replySubject = subject?.startsWith('Re:') ? subject : `Re: ${subject || ''}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
  ];
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);

  const raw = headers.join('\r\n') + '\r\n\r\n' + body;
  const encoded = Buffer.from(raw).toString('base64url');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded, threadId },
  });

  return { messageId: res.data.id, threadId: res.data.threadId };
}
