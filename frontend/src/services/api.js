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

  // Monday
  mondayBoards: () => request('/monday/boards'),

  // Q&A
  questions: (status = 'pending') => request(`/qa/questions?status=${status}`),
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
};
