import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Phone, RefreshCw, Loader, Sparkles, ChevronRight, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { timeAgo } from '../../utils/time';
import { ElenaBadge, OrganizeButton } from '../shared/ElenaOrganize';
import { usePatientName } from '../../hooks/usePatientName';

const PAGE_SIZE = 30;

// Cached conversations — shown instantly on revisit while fresh data loads
const RC_CACHE_KEY = 'corey-rc-convos-cache';

function readConvoCache() {
  try {
    const raw = localStorage.getItem(RC_CACHE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return Array.isArray(d.conversations) ? d.conversations : null;
  } catch { return null; }
}

function writeConvoCache(conversations) {
  try {
    // Trim message bodies per convo to keep localStorage small
    const slim = conversations.slice(0, 50).map(c => ({
      ...c,
      messages: (c.messages || []).slice(0, 6),
    }));
    localStorage.setItem(RC_CACHE_KEY, JSON.stringify({ conversations: slim, time: Date.now() }));
  } catch {}
}

// Header for the selected conversation — patient name resolved, phone stays
function ConvoHeader({ contact }) {
  const name = usePatientName(contact);
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <h2 className="font-semibold truncate">{name || contact}</h2>
      {name && <span className="text-xs text-surface-200/40 shrink-0">{contact}</span>}
    </div>
  );
}

export default function RingCentralView() {
  const cachedConvos = useRef(readConvoCache());
  const [conversations, setConversations] = useState(cachedConvos.current || []);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(!cachedConvos.current);
  const [updating, setUpdating] = useState(false);
  const [connected, setConnected] = useState(cachedConvos.current ? true : null);
  const [searchParams] = useSearchParams();
  const deepLinkDone = useRef(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [elenaLabels, setElenaLabels] = useState({}); // contact -> {urgency,label,reason,priority}
  const [organizing, setOrganizing] = useState(false);
  const [organizedAt, setOrganizedAt] = useState(null);
  const listRef = useRef(null);

  function indexLabels(arr) {
    const map = {};
    for (const l of arr || []) map[l.id] = l;
    return map;
  }

  async function loadMessages() {
    // Cached items stay visible — the spinner shows fresh data is coming
    const hasCache = conversations.length > 0;
    if (hasCache) setUpdating(true); else setLoading(true);
    try {
      const status = await api.rcStatus();
      setConnected(status.connected !== false);
      // 90-day lookback — backend pages through everything in range
      const data = await api.rcMessages(90);
      const fresh = data.conversations || [];
      setConversations(fresh);
      writeConvoCache(fresh);
      // If a convo is open (possibly from trimmed cache), swap in the fresh full version
      setSelected(prev => prev ? (fresh.find(c => c.contact === prev.contact) || prev) : prev);
    } catch (e) {
      if (!hasCache) setConnected(false);
    }
    setLoading(false);
    setUpdating(false);
  }

  async function loadSavedLabels() {
    try {
      const data = await api.rcOrganizeSaved();
      if (data.labels?.length) {
        setElenaLabels(indexLabels(data.labels));
        setOrganizedAt(data.labels[0]?.created_at || true);
      }
    } catch {}
  }

  async function handleOrganize() {
    setOrganizing(true);
    try {
      const data = await api.rcOrganize();
      setElenaLabels(indexLabels(data.labels));
      setOrganizedAt(data.organizedAt);
    } catch (e) {
      console.error('Organize failed:', e);
    }
    setOrganizing(false);
  }

  async function summarizeConvo(contact) {
    setSummaryLoading(true);
    try {
      const data = await api.rcSummarize(contact);
      setSummary(data.summary || data.response || JSON.stringify(data));
    } catch (e) {
      setSummary('Could not generate summary.');
    }
    setSummaryLoading(false);
  }

  // Reveal more conversations as you scroll — everything is already loaded
  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
      setVisibleCount(prev => (prev < conversations.length ? prev + PAGE_SIZE : prev));
    }
  }

  useEffect(() => { loadMessages(); loadSavedLabels(); }, []);

  // Deep link: /ringcentral?contact=<phone> opens that exact conversation
  useEffect(() => {
    const contact = searchParams.get('contact');
    if (!contact || deepLinkDone.current || conversations.length === 0) return;
    const digits = contact.replace(/\D/g, '').slice(-10);
    const match = conversations.find(c =>
      c.contact === contact ||
      (digits && (c.contact || '').replace(/\D/g, '').slice(-10) === digits)
    );
    if (match) {
      deepLinkDone.current = true;
      setSelected(match);
      setSummary(null);
    }
  }, [conversations]);

  if (connected === false) {
    return (
      <div className="card text-center py-12 space-y-4">
        <AlertTriangle size={40} className="mx-auto text-warn" />
        <h2 className="text-lg font-semibold">RingCentral Not Connected</h2>
        <p className="text-surface-200/60 text-sm">RingCentral API credentials need to be configured on the backend.</p>
      </div>
    );
  }

  const isUnreadConvo = (c) => (c.messages || []).some(m => m.readStatus === 'Unread');

  // Unreads float to top; Elena's priority orders the unreads when available
  const sorted = [...conversations].sort((a, b) => {
    const aUn = isUnreadConvo(a) ? 0 : 1;
    const bUn = isUnreadConvo(b) ? 0 : 1;
    if (aUn !== bUn) return aUn - bUn;
    if (aUn === 0) {
      const ap = elenaLabels[a.contact]?.priority ?? 999;
      const bp = elenaLabels[b.contact]?.priority ?? 999;
      if (ap !== bp) return ap - bp;
    }
    return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
  });

  const visible = sorted.slice(0, visibleCount);
  const unreadCount = conversations.filter(isUnreadConvo).length;
  const unreadLabels = Object.values(elenaLabels)
    .filter(l => conversations.some(c => c.contact === l.id && isUnreadConvo(c)))
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Phone size={20} /> RingCentral
          <span className="text-sm font-normal text-surface-200/40">({conversations.length} conversations, {unreadCount} unread)</span>
          {updating && (
            <span className="flex items-center gap-1.5 text-xs font-normal text-surface-200/40">
              <Loader size={12} className="animate-spin text-brand-400" /> Updating...
            </span>
          )}
        </h1>
        <button onClick={loadMessages} className="text-surface-200/40 hover:text-white">
          <RefreshCw size={16} className={loading || updating ? 'animate-spin' : ''} />
        </button>
      </div>

      <OrganizeButton onClick={handleOrganize} loading={organizing} count={unreadLabels.length} organizedAt={organizedAt} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div ref={listRef} onScroll={handleScroll} className="lg:col-span-2 card max-h-[70vh] overflow-y-auto p-0" data-focus-group>
          {loading && <div className="p-4 flex justify-center"><Loader size={18} className="animate-spin text-brand-500" /></div>}
          {conversations.length === 0 && !loading && (
            <p className="text-sm text-surface-200/40 p-4">No conversations found.</p>
          )}
          {visible.map((convo, i) => {
            const lastMsg = (convo.messages || [])[0];
            const unread = isUnreadConvo(convo);
            return (
              <div
                key={convo.contact || i}
                data-focus-item="" onClick={() => { setSelected(convo); setSummary(null); }}
                className={`flex items-center justify-between p-3 cursor-pointer border-b border-surface-200/5 hover:bg-surface-200/5 transition ${selected?.contact === convo.contact ? 'bg-brand-600/10 border-l-2 border-l-brand-500' : ''} ${unread ? 'bg-green-500/5' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {unread && <span className="w-2 h-2 bg-green-400 rounded-full shrink-0" />}
                    <span className={`text-sm truncate ${unread ? 'font-semibold' : ''}`}>{convo.contact}</span>
                    {elenaLabels[convo.contact] && <span className="shrink-0"><ElenaBadge info={elenaLabels[convo.contact]} compact /></span>}
                  </div>
                  {lastMsg && (
                    <p className="text-xs text-surface-200/40 truncate mt-0.5">
                      {lastMsg.direction === 'Outbound' ? 'You: ' : ''}{lastMsg.text || '(no text)'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-surface-200/30">{lastMsg ? timeAgo(lastMsg.time) : ''}</span>
                  <ChevronRight size={14} className="text-surface-200/20" />
                </div>
              </div>
            );
          })}
          {!loading && visibleCount < sorted.length && (
            <button onClick={() => setVisibleCount(v => v + PAGE_SIZE)} className="w-full p-3 text-xs text-brand-400 hover:bg-surface-200/5 transition">
              Show more ({sorted.length - visibleCount} remaining)...
            </button>
          )}
          {!loading && conversations.length > 0 && visibleCount >= sorted.length && (
            <p className="p-3 text-center text-[10px] text-surface-200/25">All conversations shown</p>
          )}
        </div>

        <div className="lg:col-span-3 card max-h-[70vh] overflow-y-auto">
          {!selected ? (
            <p className="text-surface-200/40 text-sm py-8 text-center">Select a conversation to view</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-surface-200/10">
                <div className="flex items-center gap-2 min-w-0">
                  <ConvoHeader contact={selected.contact} />
                  {elenaLabels[selected.contact] && <span className="shrink-0"><ElenaBadge info={elenaLabels[selected.contact]} /></span>}
                </div>
                <button onClick={() => summarizeConvo(selected.contact)} disabled={summaryLoading} className="btn-secondary text-xs flex items-center gap-1">
                  {summaryLoading ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Summarize
                </button>
              </div>

              {elenaLabels[selected.contact]?.reason && (
                <p className="text-xs text-brand-400/70">Elena: {elenaLabels[selected.contact].reason}</p>
              )}

              {summary && (
                <div className="bg-brand-600/10 border border-brand-600/20 rounded-lg p-3">
                  <p className="text-sm text-surface-200/80 whitespace-pre-wrap">{summary}</p>
                </div>
              )}

              {[...(selected.messages || [])].reverse().map((msg, i) => (
                <div key={msg.id || i} className={`flex ${msg.direction === 'Outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${msg.direction === 'Outbound' ? 'bg-brand-600/20' : 'bg-surface-200/10'}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.text || '(no text)'}</p>
                    <p className="text-xs text-surface-200/30 mt-1">{timeAgo(msg.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
