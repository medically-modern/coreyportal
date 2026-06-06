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
    // Safety cap
    if (allRecords.length > 500) { hasMore = false; }
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
