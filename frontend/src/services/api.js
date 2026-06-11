const API_BASE = import.meta.env.VITE_API_URL || 'https://corey-portal-api-production.up.railway.app/api';

// ── API activity tracker — feeds the small bottom-right indicator ──
const activityListeners = new Set();
let reqSeq = 0;

export function onApiActivity(fn) {
  activityListeners.add(fn);
  return () => activityListeners.delete(fn);
}

function emitActivity(evt) {
  for (const fn of activityListeners) {
    try { fn(evt); } catch {}
  }
}

// Only Elena/Claude AI calls produce a notification — plain data fetches
// (threads, messages, saved labels, patient lookups) stay silent.
// These paths are the ONLY places the app spends AI tokens, and every one
// of them is triggered by an explicit button press or chat message.
function elenaCallLabel(path, method = 'GET') {
  const p = path.split('?')[0];
  if (p.includes('/organize') && method === 'POST') return 'Elena organizing...';
  if (p.includes('/summarize')) return 'Elena summarizing...';
  if (p.includes('/triage')) return 'Elena triaging...';
  if (p.includes('/draft-reply') || p.includes('/ai-draft')) return 'Elena drafting...';
  if (p.includes('/briefing')) return 'Elena briefing...';
  if (p.includes('/focus-context')) return "Elena's take...";
  if (p.includes('/breakdown')) return 'Elena breaking it down...';
  if (p === '/assistant/chat') return 'Elena thinking...';
  return null; // not an AI call — no notification
}

export function trackApiCall(path, method = 'GET') {
  const label = elenaCallLabel(path, method);
  if (!label) return { done: () => {}, fail: () => {} };
  const id = ++reqSeq;
  emitActivity({ type: 'start', id, label });
  return {
    done: () => emitActivity({ type: 'end', id }),
    fail: () => emitActivity({ type: 'end', id, error: true }),
  };
}

async function request(path, options = {}) {
  const track = trackApiCall(path, options.method || 'GET');
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      track.fail();
      throw new Error(err.error || res.statusText);
    }
    track.done();
    return res.json();
  } catch (e) {
    track.fail();
    throw e;
  }
}

export const api = {
  // Health
  health: () => request('/health'),

  // Gmail
  gmailStatus: () => request('/gmail/status'),
  gmailThreads: (max = 100, pageToken = null) => request(`/gmail/threads?max=${max}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`),
  gmailOrganize: () => request('/gmail/organize', { method: 'POST', body: JSON.stringify({}) }),
  gmailOrganizeSaved: () => request('/gmail/organize'),
  gmailThread: (id) => request(`/gmail/thread/${id}`),
  gmailUnread: () => request('/gmail/unread'),
  gmailSummarize: (threadId) => request(`/gmail/summarize/${threadId}`),
  gmailTriage: () => request('/gmail/triage'),
  gmailSearch: (q) => request(`/gmail/search?q=${encodeURIComponent(q)}`),
  gmailMarkRead: (threadId) => request(`/gmail/thread/${threadId}/read`, { method: 'POST' }),
  gmailReply: (threadId, to, subject, body) => request('/gmail/reply', { method: 'POST', body: JSON.stringify({ threadId, to, subject, body }) }),

  // Slack
  slackStatus: () => request('/slack/status'),
  slackChannels: () => request('/slack/channels'),
  slackMessages: (channelId, limit = 50) => request(`/slack/channels/${channelId}/messages?limit=${limit}`),
  slackThread: (channelId, ts) => request(`/slack/channels/${channelId}/thread/${ts}`),
  slackSummarize: (channelId) => request(`/slack/channels/${channelId}/summarize`),
  slackTriage: () => request('/slack/triage'),
  slackSearch: (q) => request(`/slack/search?q=${encodeURIComponent(q)}`),
  slackDMs: () => request('/slack/dms'),

  // RingCentral
  rcStatus: () => request('/ringcentral/status'),
  rcMessages: (daysBack = null, perPage = 250) => request(`/ringcentral/messages?perPage=${perPage}${daysBack ? `&daysBack=${daysBack}` : ''}`),
  rcOrganize: () => request('/ringcentral/organize', { method: 'POST', body: JSON.stringify({}) }),
  rcOrganizeSaved: () => request('/ringcentral/organize'),
  rcSummarize: (phone) => request(`/ringcentral/summarize/${encodeURIComponent(phone)}`),
  rcFullConversation: (phone) => request(`/ringcentral/conversation/${encodeURIComponent(phone)}`),
  rcSendSMS: (to, text) => request('/ringcentral/send-sms', { method: 'POST', body: JSON.stringify({ to, text }) }),
  rcMarkRead: (messageIds) => request('/ringcentral/mark-read', { method: 'POST', body: JSON.stringify({ messageIds }) }),

  // Monday
  mondayBoards: () => request('/monday/boards'),
  mondaySearch: (q) => request(`/monday/search?q=${encodeURIComponent(q)}`),
  mondayResolvePhones: (phones) => request('/monday/resolve', { method: 'POST', body: JSON.stringify({ phones }) }),

  // Q&A
  questions: (status = 'pending') => request(`/qa/questions?status=${status}`),
  qaUploadAttachments: async (questionId, files, uploadedBy = 'employee') => {
    const track = trackApiCall(`/qa/questions/${questionId}/attachments`, 'POST');
    try {
      const fd = new FormData();
      [...files].forEach(f => fd.append('files', f));
      fd.append('uploaded_by', uploadedBy);
      const res = await fetch(`${API_BASE}/qa/questions/${questionId}/attachments`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        track.fail();
        throw new Error(err.error || 'Upload failed');
      }
      track.done();
      return res.json();
    } catch (e) {
      track.fail();
      throw e;
    }
  },
  qaAttachmentUrl: (attachmentId) => `${API_BASE}/qa/attachments/${attachmentId}/download`,
  qaAttachmentViewUrl: (attachmentId) => `${API_BASE}/qa/attachments/${attachmentId}/view`,
  qaDeleteAttachment: (attachmentId) => request(`/qa/attachments/${attachmentId}`, { method: 'DELETE' }),
  submitQuestion: (data) => request('/qa/questions', { method: 'POST', body: JSON.stringify(data) }),
  answerQuestion: (id, answer) => request(`/qa/questions/${id}/answer`, { method: 'POST', body: JSON.stringify({ answer }) }),
  archiveQuestion: (id) => request(`/qa/questions/${id}/archive`, { method: 'POST' }),
  restoreQuestion: (id) => request(`/qa/questions/${id}/restore`, { method: 'POST' }),

  // Assistant (Elena)
  chat: (message) => request('/assistant/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  briefing: () => request('/assistant/briefing', { method: 'POST', body: JSON.stringify({}) }),
  chatHistory: () => request('/assistant/history'),
  followups: () => request('/assistant/followups'),
  decisions: () => request('/assistant/decisions'),

  // Context
  searchEntities: (q) => request(`/context/entities?q=${encodeURIComponent(q)}`),
  entityDetail: (name) => request(`/context/entity/${encodeURIComponent(name)}`),

  // Elena memory
  elenaMemory: () => request('/elena/memory'),
  elenaTeach: (fact) => request('/elena/teach', { method: 'POST', body: JSON.stringify(fact) }),

  // Focus context (Elena per-item analysis)
  focusContext: (item) => request('/assistant/focus-context', { method: 'POST', body: JSON.stringify({ item }) }),
  draftReply: (data) => request('/assistant/draft-reply', { method: 'POST', body: JSON.stringify(data) }),

  // Trash
  trashList: () => request('/trash'),
  trashRestore: (type, id) => request('/trash/restore', { method: 'POST', body: JSON.stringify({ type, id }) }),
  trashPurgeItem: (type, id) => request('/trash/item', { method: 'DELETE', body: JSON.stringify({ type, id }) }),
  trashEmpty: () => request('/trash/empty', { method: 'POST' }),

  // Parking Lot notes
  notesGet: () => request('/notes'),
  notesCreate: (text, color) => request('/notes', { method: 'POST', body: JSON.stringify({ text, color }) }),
  notesUpdate: (id, data) => request(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  notesDelete: (id) => request(`/notes/${id}`, { method: 'DELETE' }),

  // Projects
  projectsList: () => request('/projects'),
  projectCreate: (name, color, type) => request('/projects', { method: 'POST', body: JSON.stringify({ name, color, type }) }),
  projectDelete: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  projectUpdate: (id, data) => request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  projectBoard: (id) => request(`/projects/${id}/board`),
  projectTaskCreate: (projectId, data) => request(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  projectTaskUpdate: (projectId, taskId, data) => request(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  projectTaskDelete: (projectId, taskId) => request(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),
  projectTaskMove: (projectId, taskId, data) => request(`/projects/${projectId}/tasks/${taskId}/move`, { method: 'POST', body: JSON.stringify(data) }),
  projectColumnReorder: (projectId, columnId, taskIds) => request(`/projects/${projectId}/columns/${columnId}/reorder`, { method: 'POST', body: JSON.stringify({ taskIds }) }),
  projectTaskBreakdown: (projectId, taskId) => request(`/projects/${projectId}/tasks/${taskId}/breakdown`, { method: 'POST' }),
  projectMemberAdd: (projectId, name) => request(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ name }) }),
  projectMemberRemove: (projectId, memberId) => request(`/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),
};
