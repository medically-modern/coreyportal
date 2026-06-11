import { SDK } from '@ringcentral/sdk';

let platform = null;

async function getPlatform() {
  if (platform) {
    // Check if token is still valid, refresh if needed
    try {
      await platform.ensureLoggedIn();
      return platform;
    } catch (e) {
      platform = null;
    }
  }

  const sdk = new SDK({
    server: process.env.RC_SERVER || 'https://platform.ringcentral.com',
    clientId: process.env.RC_CLIENT_ID,
    clientSecret: process.env.RC_CLIENT_SECRET,
  });

  platform = sdk.platform();
  await platform.login({ jwt: process.env.RC_JWT_TOKEN });
  console.log('RingCentral authenticated');
  return platform;
}

// ---- TEXT MESSAGES ----

export async function getTextConversations(perPage = 100, daysBack = null) {
  const p = await getPlatform();

  const params = {
    messageType: ['SMS'],
    perPage,
    direction: ['Inbound', 'Outbound'],
  };

  // Filter by date range if specified
  if (daysBack) {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    params.dateFrom = since.toISOString();
  }

  // Paginate to get all messages in range
  let allRecords = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    params.page = page;
    const res = await p.get('/restapi/v1.0/account/~/extension/~/message-store', params);
    const data = await res.json();
    const records = data.records || [];
    allRecords = allRecords.concat(records);

    // RC API paging
    if (data.paging && data.paging.page < data.paging.totalPages) {
      page++;
    } else {
      hasMore = false;
    }
    // Cap at 10 pages (matches getAllMessages — stays under RC heavy-tier rate limits)
    if (allRecords.length > 2500 || page > 10) { hasMore = false; }
  }

  const data = { records: allRecords };

  // Group messages by conversation (by phone number)
  const convos = {};
  for (const msg of data.records || []) {
    const otherParty = msg.direction === 'Inbound'
      ? msg.from?.phoneNumber || msg.from?.name || 'Unknown'
      : (msg.to?.[0]?.phoneNumber || msg.to?.[0]?.name || 'Unknown');

    if (!convos[otherParty]) {
      convos[otherParty] = {
        contact: otherParty,
        messages: [],
        lastMessageTime: msg.creationTime,
        unread: 0,
      };
    }
    convos[otherParty].messages.push({
      id: msg.id,
      direction: msg.direction,
      text: msg.subject,
      time: msg.creationTime,
      readStatus: msg.readStatus,
    });
    if (msg.readStatus === 'Unread') {
      convos[otherParty].unread++;
    }
  }

  // Sort by most recent
  return Object.values(convos).sort(
    (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
  );
}

export async function getConversationMessages(phoneNumber, perPage = 50) {
  const p = await getPlatform();
  const res = await p.get('/restapi/v1.0/account/~/extension/~/message-store', {
    messageType: ['SMS'],
    perPage,
    phoneNumber,
  });
  const data = await res.json();
  return (data.records || []).map(msg => ({
    id: msg.id,
    direction: msg.direction,
    text: msg.subject,
    time: msg.creationTime,
    from: msg.from?.phoneNumber || msg.from?.name,
    to: msg.to?.[0]?.phoneNumber || msg.to?.[0]?.name,
    readStatus: msg.readStatus,
  }));
}

// ─── Conversation cache ───
// phone (last 10 digits) → { messages: [...], fetchedAt: timestamp }
const convoCache = new Map();
const CONVO_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let allMessagesCache = null;
let allMessagesCacheTime = 0;
const ALL_MSGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch all SMS once (with caching), then filter per-phone from cache
async function getAllMessages(daysBack = 90) {
  if (allMessagesCache && (Date.now() - allMessagesCacheTime < ALL_MSGS_CACHE_TTL)) {
    return allMessagesCache;
  }

  const p = await getPlatform();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  let allRecords = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await p.get('/restapi/v1.0/account/~/extension/~/message-store', {
      messageType: ['SMS'],
      perPage: 250,
      page,
      dateFrom: since.toISOString(),
    });
    const data = await res.json();
    const records = data.records || [];
    allRecords = allRecords.concat(records);

    if (data.paging && data.paging.page < data.paging.totalPages) {
      page++;
    } else {
      hasMore = false;
    }
    // Cap at 10 pages (2500 msgs) to stay under rate limits
    if (page > 10) hasMore = false;
  }

  allMessagesCache = allRecords;
  allMessagesCacheTime = Date.now();
  console.log(`[RC] Cached ${allRecords.length} SMS messages (${page - 1} pages, ${daysBack} day lookback)`);
  return allRecords;
}

// Get ALL messages for a specific phone number — uses cached message store
export async function getFullConversation(phoneNumber, daysBack = 90) {
  const phoneDigits = phoneNumber.replace(/\D/g, '');
  const last10 = phoneDigits.slice(-10);

  // Check per-phone cache first
  const cached = convoCache.get(last10);
  if (cached && (Date.now() - cached.fetchedAt < CONVO_CACHE_TTL)) {
    return cached.messages;
  }

  const allRecords = await getAllMessages(daysBack);
  const matched = [];

  for (const msg of allRecords) {
    const from = (msg.from?.phoneNumber || '').replace(/\D/g, '');
    const to = (msg.to?.[0]?.phoneNumber || '').replace(/\D/g, '');
    if (from.slice(-10) === last10 || to.slice(-10) === last10) {
      matched.push({
        direction: msg.direction,
        text: msg.subject,
        time: msg.creationTime,
        readStatus: msg.readStatus,
      });
    }
  }

  // Sort chronologically (oldest first)
  matched.sort((a, b) => new Date(a.time) - new Date(b.time));

  // Cache per-phone result
  convoCache.set(last10, { messages: matched, fetchedAt: Date.now() });
  return matched;
}

// ---- VOICEMAILS ----

export async function getVoicemails(perPage = 20) {
  const p = await getPlatform();
  const res = await p.get('/restapi/v1.0/account/~/extension/~/message-store', {
    messageType: ['VoiceMail'],
    perPage,
  });
  const data = await res.json();

  return (data.records || []).map(vm => ({
    id: vm.id,
    from: vm.from?.phoneNumber || vm.from?.name || 'Unknown',
    fromName: vm.from?.name || null,
    time: vm.creationTime,
    duration: vm.attachments?.[0]?.size ? Math.round(vm.attachments[0].size / 8000) : null, // rough estimate
    readStatus: vm.readStatus,
    transcription: vm.vmTranscriptionStatus === 'Completed'
      ? vm.attachments?.find(a => a.type === 'Transcription')
      : null,
    hasAudio: vm.attachments?.some(a => a.type === 'AudioRecording'),
    audioUri: vm.attachments?.find(a => a.type === 'AudioRecording')?.uri || null,
  }));
}

export async function getVoicemailContent(messageId, attachmentId) {
  const p = await getPlatform();
  const res = await p.get(
    `/restapi/v1.0/account/~/extension/~/message-store/${messageId}/content/${attachmentId}`
  );
  return res;
}

// ---- CALL LOG ----

export async function getCallLog(perPage = 25, type = null) {
  const p = await getPlatform();
  const params = {
    perPage,
    view: 'Simple',
  };
  if (type) params.type = type; // 'Voice', 'Fax'

  const res = await p.get('/restapi/v1.0/account/~/extension/~/call-log', params);
  const data = await res.json();

  return (data.records || []).map(call => ({
    id: call.id,
    direction: call.direction,
    from: call.from?.phoneNumber || call.from?.name || 'Unknown',
    fromName: call.from?.name || null,
    to: call.to?.phoneNumber || call.to?.name || 'Unknown',
    toName: call.to?.name || null,
    duration: call.duration,
    result: call.result, // 'Missed', 'Accepted', 'Voicemail', etc.
    time: call.startTime,
    type: call.type,
  }));
}

export async function getMissedCalls(perPage = 10) {
  const p = await getPlatform();
  const res = await p.get('/restapi/v1.0/account/~/extension/~/call-log', {
    perPage,
    view: 'Simple',
    type: 'Voice',
    result: 'Missed',
  });
  const data = await res.json();
  return (data.records || []).map(call => ({
    id: call.id,
    from: call.from?.phoneNumber || call.from?.name || 'Unknown',
    fromName: call.from?.name || null,
    time: call.startTime,
  }));
}

// ---- SEND SMS ----

export async function sendSMS(toNumber, text) {
  const p = await getPlatform();

  // Get the user's phone number from their extension
  const extRes = await p.get('/restapi/v1.0/account/~/extension/~');
  const ext = await extRes.json();
  const fromNumber = ext.extensionNumber
    ? null // will use default
    : null;

  // Get the first SMS-capable phone number
  const phonesRes = await p.get('/restapi/v1.0/account/~/extension/~/phone-number');
  const phones = await phonesRes.json();
  const smsPhone = (phones.records || []).find(
    ph => ph.features?.includes('SmsSender')
  );

  if (!smsPhone) throw new Error('No SMS-capable phone number found on this extension');

  const res = await p.post('/restapi/v1.0/account/~/extension/~/sms', {
    from: { phoneNumber: smsPhone.phoneNumber },
    to: [{ phoneNumber: toNumber }],
    text,
  });

  const data = await res.json();

  // Invalidate caches so new message shows up
  allMessagesCache = null;
  const digits = toNumber.replace(/\D/g, '').slice(-10);
  convoCache.delete(digits);

  return {
    id: data.id,
    to: toNumber,
    text: data.subject,
    time: data.creationTime,
  };
}

// ---- HEALTH CHECK ----

export async function checkConnection() {
  try {
    const p = await getPlatform();
    const res = await p.get('/restapi/v1.0/account/~/extension/~');
    const ext = await res.json();
    return { connected: true, extension: ext.name, extensionNumber: ext.extensionNumber };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}
