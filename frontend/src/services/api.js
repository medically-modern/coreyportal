const API_BASE = import.meta.env.VITE_API_URL || 'https://corey-portal-api-production.up.railway.app/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Health
  health: () => request('/health'),

  // Gmail
  gmailStatus: () => request('/gmail/status'),
  gmailThreads: (max = 100) => request(`/gmail/threads?max=${max}`),
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
  rcMessages: () => request('/ringcentral/messages'),
  rcSummarize: (phone) => request(`/ringcentral/summarize/${encodeURIComponent(phone)}`),
  rcFullConversation: (phone) => request(`/ringcentral/conversation/${encodeURIComponent(phone)}`),
  rcSendSMS: (to, text) => request('/ringcentral/send-sms', { method: 'POST', body: JSON.stringify({ to, text }) }),

  // Monday
  mondayBoards: () => request('/monday/boards'),

  // Q&A
  questions: (status = 'pending') => request(`/qa/questions?status=${status}`),
  qaUploadAttachments: async (questionId, files, uploadedBy = 'employee') => {
    const fd = new FormData();
    [...files].forEach(f => fd.append('files', f));
    fd.append('uploaded_by', uploadedBy);
    const res = await fetch(`${API_BASE}/qa/questions/${questionId}/attachments`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },
  qaAttachmentUrl: (attachmentId) => `${API_BASE}/qa/attachments/${attachmentId}/download`,
  qaDeleteAttachment: (attachmentId) => request(`/qa/attachments/${attachmentId}`, { method: 'DELETE' }),
  submitQuestion: (data) => request('/qa/questions', { method: 'POST', body: JSON.stringify(data) }),
  answerQuestion: (id, answer) => request(`/qa/questions/${id}/answer`, { method: 'POST', body: JSON.stringify({ answer }) }),

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
  projectTaskBreakdown: (projectId, taskId) => request(`/projects/${projectId}/tasks/${taskId}/breakdown`, { method: 'POST' }),
  projectMemberAdd: (projectId, name) => request(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ name }) }),
  projectMemberRemove: (projectId, memberId) => request(`/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),
};
