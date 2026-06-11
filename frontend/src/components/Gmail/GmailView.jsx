import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Search, RefreshCw, Loader, ExternalLink, Sparkles, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { timeAgo } from '../../utils/time';
import { ElenaBadge, OrganizeButton, PriorityPanel } from '../shared/ElenaOrganize';

// Cached threads — shown instantly on revisit while fresh data loads behind a spinner
const GMAIL_CACHE_KEY = 'corey-gmail-threads-cache';

function readThreadCache() {
  try {
    const raw = localStorage.getItem(GMAIL_CACHE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return Array.isArray(d.threads) ? d.threads : null;
  } catch { return null; }
}

function writeThreadCache(threads) {
  try {
    localStorage.setItem(GMAIL_CACHE_KEY, JSON.stringify({ threads: threads.slice(0, 50), time: Date.now() }));
  } catch {}
}

function ThreadRow({ thread, onSelect, selected, elenaInfo }) {
  const unread = thread.isUnread || thread.unread;
  return (
    <div
      data-focus-item="" onClick={() => onSelect(thread)}
      className={`flex items-start gap-3 p-3 cursor-pointer border-b border-surface-200/5 hover:bg-surface-200/5 transition ${selected ? 'bg-brand-600/10 border-l-2 border-l-brand-500' : ''} ${unread ? 'bg-blue-500/5' : ''}`}
    >
      <div className="pt-1.5 shrink-0">
        {unread ? (
          <span className="block w-2.5 h-2.5 bg-blue-500 rounded-full" title="Unprocessed" />
        ) : (
          <span className="block w-2.5 h-2.5 border border-surface-200/20 rounded-full" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between items-baseline">
          <p className={`text-sm truncate ${unread ? 'font-bold text-white' : 'text-surface-200/70'}`}>
            {thread.from?.split('<')[0]?.trim() || 'Unknown'}
          </p>
          <span className="text-xs text-surface-200/30 shrink-0 ml-2">{timeAgo(thread.date)}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <p className={`text-sm truncate ${unread ? 'font-semibold text-surface-200/90' : 'text-surface-200/50'}`}>{thread.subject}</p>
          {elenaInfo && <span className="shrink-0"><ElenaBadge info={elenaInfo} /></span>}
        </div>
        <p className="text-xs truncate text-surface-200/30 mt-0.5">{thread.snippet}</p>
      </div>
    </div>
  );
}

export default function GmailView() {
  const cachedThreads = useRef(readThreadCache());
  const [connected, setConnected] = useState(cachedThreads.current ? true : null);
  const [threads, setThreads] = useState(cachedThreads.current || []);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(!cachedThreads.current);
  const [updating, setUpdating] = useState(false);
  const [searchParams] = useSearchParams();
  const deepLinkDone = useRef(false);
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all | unread
  const [elenaLabels, setElenaLabels] = useState({}); // threadId -> {urgency,label,reason,priority}
  const [organizing, setOrganizing] = useState(false);
  const [organizedAt, setOrganizedAt] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const listRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'https://corey-portal-api-production.up.railway.app/api';

  function indexLabels(arr) {
    const map = {};
    for (const l of arr || []) map[l.id] = l;
    return map;
  }

  async function loadGmail() {
    // Cached items stay visible — the spinner shows fresh data is coming
    const hasCache = threads.length > 0;
    if (hasCache) setUpdating(true); else setLoading(true);
    setSearching(false);
    try {
      const status = await api.gmailStatus();
      setConnected(status.connected);
      if (status.connected) {
        const data = await api.gmailThreads(50);
        setThreads(data.threads || []);
        setNextPageToken(data.nextPageToken || null);
        writeThreadCache(data.threads || []);
      }
    } catch (e) {
      if (!hasCache) setConnected(false);
    }
    setLoading(false);
    setUpdating(false);
  }

  // Saved Elena labels — loaded once per page view, NO AI call
  async function loadSavedLabels() {
    try {
      const data = await api.gmailOrganizeSaved();
      if (data.labels?.length) {
        setElenaLabels(indexLabels(data.labels));
        setOrganizedAt(data.labels[0]?.created_at || true);
      }
    } catch {}
  }

  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore || searching) return;
    setLoadingMore(true);
    try {
      const data = await api.gmailThreads(50, nextPageToken);
      setThreads(prev => {
        const seen = new Set(prev.map(t => t.id));
        return [...prev, ...(data.threads || []).filter(t => !seen.has(t.id))];
      });
      setNextPageToken(data.nextPageToken || null);
    } catch {}
    setLoadingMore(false);
  }, [nextPageToken, loadingMore, searching]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) loadMore();
  }

  async function handleOrganize() {
    setOrganizing(true);
    try {
      const data = await api.gmailOrganize();
      setElenaLabels(indexLabels(data.labels));
      setOrganizedAt(data.organizedAt);
      setPanelOpen(true);
    } catch (e) {
      console.error('Organize failed:', e);
    }
    setOrganizing(false);
  }

  async function selectThread(thread) {
    setSelected(thread);
    setSummary(null);
    setDetail(null);
    try {
      const data = await api.gmailThread(thread.id);
      setDetail(data.thread || data);
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
    setSearching(true);
    try {
      const data = await api.gmailSearch(searchQ);
      setThreads(data.threads || []);
      setNextPageToken(null);
    } catch (e) {}
    setLoading(false);
  }

  useEffect(() => { loadGmail(); loadSavedLabels(); }, []);

  // Deep link: /gmail?thread=<id> opens that exact email
  useEffect(() => {
    const tid = searchParams.get('thread');
    if (!tid || deepLinkDone.current) return;
    const t = threads.find(x => x.id === tid);
    if (t) {
      deepLinkDone.current = true;
      selectThread(t);
    } else if (!loading && threads.length > 0) {
      // Not in the loaded list — fetch the thread directly
      deepLinkDone.current = true;
      api.gmailThread(tid).then(data => {
        const th = data.thread || data;
        const last = th.messages?.[th.messages.length - 1] || {};
        setSelected({ id: tid, subject: last.subject || '(email)', from: last.from || '', date: last.date || '', snippet: '' });
        setDetail(th);
      }).catch(() => {});
    }
  }, [threads, loading]);

  // Unreads always float to the top; Elena's priority orders the unreads when available
  const sortedThreads = [...threads].sort((a, b) => {
    const aUn = (a.isUnread || a.unread) ? 0 : 1;
    const bUn = (b.isUnread || b.unread) ? 0 : 1;
    if (aUn !== bUn) return aUn - bUn;
    if (aUn === 0) {
      const ap = elenaLabels[a.id]?.priority ?? 999;
      const bp = elenaLabels[b.id]?.priority ?? 999;
      if (ap !== bp) return ap - bp;
    }
    return new Date(b.date) - new Date(a.date);
  });

  const filteredThreads = filter === 'unread'
    ? sortedThreads.filter(t => t.isUnread || t.unread)
    : sortedThreads;

  const unreadCount = threads.filter(t => t.isUnread || t.unread).length;
  const unreadLabels = Object.values(elenaLabels)
    .filter(l => threads.some(t => t.id === l.id && (t.isUnread || t.unread)))
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

  if (connected === null && loading) {
    return <div className="flex items-center justify-center h-64"><Loader className="animate-spin text-brand-500" size={24} /></div>;
  }

  if (connected === false) {
    return (
      <div className="card text-center py-12 space-y-4">
        <AlertTriangle size={40} className="mx-auto text-warn" />
        <h2 className="text-lg font-semibold">Gmail Not Connected</h2>
        <p className="text-surface-200/60 text-sm max-w-md mx-auto">
          Gmail needs to be authorized to show emails. Click below to connect.
        </p>
        <a href={`${API_BASE.replace('/api', '')}/api/gmail/auth`} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2">
          <ExternalLink size={14} /> Connect Gmail
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Mail size={20} /> Email
          <span className="text-sm font-normal text-surface-200/40">({threads.length} loaded, {unreadCount} unprocessed)</span>
          {updating && (
            <span className="flex items-center gap-1.5 text-xs font-normal text-surface-200/40">
              <Loader size={12} className="animate-spin text-brand-400" /> Updating...
            </span>
          )}
        </h1>
        <button onClick={loadGmail} className="text-surface-200/40 hover:text-white">
          <RefreshCw size={16} className={loading || updating ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')} className={`text-xs px-3 py-1.5 rounded-full transition ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-surface-200/10 text-surface-200/60'}`}>
            All ({threads.length})
          </button>
          <button onClick={() => setFilter('unread')} className={`text-xs px-3 py-1.5 rounded-full transition ${filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-surface-200/10 text-surface-200/60'}`}>
            Unprocessed ({unreadCount})
          </button>
        </div>
        <OrganizeButton onClick={handleOrganize} loading={organizing} count={unreadLabels.length} organizedAt={organizedAt} />
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-200/40" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search emails..." className="input pl-9 w-full" />
          </div>
        </form>
      </div>

      <PriorityPanel
        labels={unreadLabels}
        itemLookup={(id) => {
          const t = threads.find(x => x.id === id);
          return t ? { ...t, title: `${t.from?.split('<')[0]?.trim() || ''}: ${t.subject || ''}` } : null;
        }}
        open={panelOpen}
        onToggle={() => setPanelOpen(p => !p)}
        onSelect={selectThread}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div ref={listRef} onScroll={handleScroll} className="lg:col-span-2 card max-h-[70vh] overflow-y-auto p-0" data-focus-group>
          {loading && <div className="p-4 flex justify-center"><Loader size={18} className="animate-spin text-brand-500" /></div>}
          {filteredThreads.length === 0 && !loading && (
            <p className="text-sm text-surface-200/40 p-4">No emails found.</p>
          )}
          {filteredThreads.map((t, i) => (
            <ThreadRow key={t.id || i} thread={t} onSelect={selectThread} selected={selected?.id === t.id} elenaInfo={elenaLabels[t.id]} />
          ))}
          {loadingMore && <div className="p-3 flex justify-center"><Loader size={14} className="animate-spin text-brand-500" /></div>}
          {!loading && !loadingMore && nextPageToken && (
            <button onClick={loadMore} className="w-full p-3 text-xs text-brand-400 hover:bg-surface-200/5 transition">
              Load more...
            </button>
          )}
          {!loading && !nextPageToken && threads.length > 0 && !searching && (
            <p className="p-3 text-center text-[10px] text-surface-200/25">All emails loaded</p>
          )}
        </div>

        <div className="lg:col-span-3 card max-h-[70vh] overflow-y-auto">
          {!selected ? (
            <p className="text-surface-200/40 text-sm py-8 text-center">Select an email to view</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(selected.isUnread || selected.unread) && <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">Unprocessed</span>}
                  {elenaLabels[selected.id] && <ElenaBadge info={elenaLabels[selected.id]} />}
                  <h2 className="font-semibold">{selected.subject}</h2>
                </div>
                <p className="text-sm text-surface-200/60">{selected.from} · {timeAgo(selected.date)}</p>
                {elenaLabels[selected.id]?.reason && (
                  <p className="text-xs text-brand-400/70 mt-1">Elena: {elenaLabels[selected.id].reason}</p>
                )}
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
