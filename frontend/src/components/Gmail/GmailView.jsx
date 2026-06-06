import React, { useState, useEffect } from 'react';
import { Mail, Search, RefreshCw, Loader, ExternalLink, Eye, Sparkles, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ThreadRow({ thread, onSelect, selected }) {
  return (
    <div
      onClick={() => onSelect(thread)}
      className={`flex items-center gap-3 p-3 cursor-pointer border-b border-surface-200/5 hover:bg-surface-200/5 transition ${selected ? 'bg-brand-600/10 border-l-2 border-l-brand-500' : ''}`}
    >
      {thread.unread && <span className="w-2 h-2 bg-brand-500 rounded-full shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="flex justify-between items-baseline">
          <p className={`text-sm truncate ${thread.unread ? 'font-semibold' : ''}`}>{thread.from || 'Unknown'}</p>
          <span className="text-xs text-surface-200/40 shrink-0 ml-2">{timeAgo(thread.date)}</span>
        </div>
        <p className="text-sm truncate text-surface-200/70">{thread.subject}</p>
        <p className="text-xs truncate text-surface-200/40 mt-0.5">{thread.snippet}</p>
      </div>
    </div>
  );
}

export default function GmailView() {
  const [connected, setConnected] = useState(null); // null = loading
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'https://corey-portal-api-production.up.railway.app/api';

  async function loadGmail() {
    setLoading(true);
    try {
      const status = await api.gmailStatus();
      setConnected(status.connected);
      if (status.connected) {
        const data = await api.gmailThreads();
        setThreads(data.threads || data || []);
      }
    } catch (e) {
      setConnected(false);
    }
    setLoading(false);
  }

  async function selectThread(thread) {
    setSelected(thread);
    setSummary(null);
    setDetail(null);
    try {
      const data = await api.gmailThread(thread.id);
      setDetail(data);
    } catch (e) {}
  }

  async function summarizeThread() {
    if (!selected) return;
    setSummaryLoading(true);
    try {
      const data = await api.gmailSummarize(selected.id);
      setSummary(data.summary || data.response || JSON.stringify(data));
    } catch (e) {
      setSummary('Could not generate summary.');
    }
    setSummaryLoading(false);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQ.trim()) return loadGmail();
    setLoading(true);
    try {
      const data = await api.gmailSearch(searchQ);
      setThreads(data.threads || data || []);
    } catch (e) {}
    setLoading(false);
  }

  useEffect(() => { loadGmail(); }, []);

  if (connected === null && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin text-brand-500" size={24} />
      </div>
    );
  }

  if (connected === false) {
    return (
      <div className="card text-center py-12 space-y-4">
        <AlertTriangle size={40} className="mx-auto text-yellow-500" />
        <h2 className="text-lg font-semibold">Gmail Not Connected</h2>
        <p className="text-surface-200/60 text-sm max-w-md mx-auto">
          Gmail needs to be authorized to show your emails. Click below to connect your Google account.
        </p>
        <a
          href={`${API_BASE.replace('/api', '')}/api/gmail/auth`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex items-center gap-2"
        >
          <ExternalLink size={14} /> Connect Gmail
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Mail size={20} /> Gmail
        </h1>
        <button onClick={loadGmail} className="text-surface-200/40 hover:text-white">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-200/40" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search emails..."
            className="input pl-9 w-full"
          />
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 card max-h-[70vh] overflow-y-auto p-0">
          {threads.length === 0 && !loading && (
            <p className="text-sm text-surface-200/40 p-4">No emails found.</p>
          )}
          {threads.map((t, i) => (
            <ThreadRow key={t.id || i} thread={t} onSelect={selectThread} selected={selected?.id === t.id} />
          ))}
        </div>

        <div className="lg:col-span-3 card">
          {!selected ? (
            <p className="text-surface-200/40 text-sm py-8 text-center">Select an email to view</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold">{selected.subject}</h2>
                <p className="text-sm text-surface-200/60">{selected.from} · {timeAgo(selected.date)}</p>
              </div>

              <button onClick={summarizeThread} disabled={summaryLoading} className="btn-secondary text-xs flex items-center gap-1">
                {summaryLoading ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Elena Summarize
              </button>

              {summary && (
                <div className="bg-brand-600/10 border border-brand-600/20 rounded-lg p-3">
                  <p className="text-sm text-surface-200/80 whitespace-pre-wrap">{summary}</p>
                </div>
              )}

              <div className="border-t border-surface-200/10 pt-4">
                {detail?.messages ? (
                  detail.messages.map((msg, i) => (
                    <div key={i} className="mb-4 pb-4 border-b border-surface-200/5 last:border-0">
                      <p className="text-xs text-surface-200/40 mb-1">{msg.from} · {timeAgo(msg.date)}</p>
                      <div className="text-sm text-surface-200/80 whitespace-pre-wrap">{msg.body || msg.snippet}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-surface-200/70 whitespace-pre-wrap">{selected.snippet}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
