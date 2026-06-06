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
  // Dashboard
  dashboard: () => request('/dashboard'),

  // Gmail
  gmailThreads: (q = '') => request(`/gmail/threads?q=${encodeURIComponent(q)}`),
  gmailSummarize: (threadId) => request(`/gmail/summarize/${threadId}`),

  // Slack / Q&A
  questions: (status = 'pending') => request(`/qa/questions?status=${status}`),
  submitQuestion: (data) => request('/qa/questions', { method: 'POST', body: JSON.stringify(data) }),
  answerQuestion: (id, answer) => request(`/qa/questions/${id}/answer`, { method: 'POST', body: JSON.stringify({ answer }) }),

  // RingCentral
  rcMessages: () => request('/ringcentral/messages'),
  rcSummarize: (conversationId) => request(`/ringcentral/summarize/${conversationId}`),
  rcVoicemails: () => request('/ringcentral/voicemails'),

  // Monday
  mondayBoards: () => request('/monday/boards'),

  // Assistant
  chat: (message, context = {}) => request('/assistant/chat', { method: 'POST', body: JSON.stringify({ message, context }) }),
  chatHistory: () => request('/assistant/history'),

  // Health
  health: () => request('/health'),
};
