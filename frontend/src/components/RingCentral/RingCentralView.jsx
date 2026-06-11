import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Phone, RefreshCw, Loader, Sparkles, ChevronRight, AlertTriangle, Send, CheckCircle2, Eraser, Search, X } from 'lucide-react';
import ElenaLogo from '../shared/ElenaLogo';
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

// SMS reply composer — write or Elena-draft, send right from the conversation
function SmsReplyBox({ contact, lastInboundText, onSent }) {
  const [text, setText] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // 'sent' | 'error'
  const taRef = useRef(null);

  const isPhone = /^\+?\d[\d\s().-]{7,}$/.test(contact || '');
  if (!isPhone) return null;

  function autosize() {
    const ta = taRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }

  async function handleDraft() {
    setDrafting(true);
    try {
      const res = await api.draftReply({
        channel: 'text',
        originalText: lastInboundText || '',
        from: contact,
      });
      setText(res.draft || '');
      setTimeout(() => { autosize(); taRef.current?.focus(); }, 50);
    } catch {
      setText("(Elena couldn't draft a reply — write your own)");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setResult(null);
    try {
      await api.rcSendSMS(contact, text.trim());
      setResult('sent');
      onSent?.(text.trim());
      setText('');
      setTimeout(() => setResult(null), 2500);
    } catch (e) {
      console.error('SMS send error:', e);
      setResult('error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="sticky bottom-0 bg-surface-800 rounded-xl border border-surface-200/10 p-3 space-y-2 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-surface-200/30 uppercase tracking-wider font-semibold">Reply via Text</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDraft}
            disabled={drafting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-600/20 text-brand-400 text-xs font-medium hover:bg-brand-600/30 transition disabled:opacity-50"
          >
            {drafting ? <Loader size={10} className="animate-spin" /> : <ElenaLogo size={12} />}
            {drafting ? 'Drafting...' : 'Elena Draft'}
          </button>
          {text && (
            <button
              onClick={() => { setText(''); setResult(null); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-200/10 text-surface-200/50 text-xs hover:bg-surface-200/15 transition"
            >
              <Eraser size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      <textarea
        ref={taRef}
        value={text}
        onChange={e => { setText(e.target.value); setResult(null); autosize(); }}
        placeholder="Type a message..."
        rows={2}
        className="w-full bg-surface-900/50 border border-surface-200/10 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-200/25 resize-none focus:outline-none focus:border-brand-600/40 transition"
      />

      <div className="flex items-center justify-between">
        <div className="text-xs">
          {result === 'sent' && <span className="text-good flex items-center gap-1"><CheckCircle2 size={12} /> Sent!</span>}
          {result === 'error' && <span className="text-bad">Failed to send. Try again.</span>}
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {sending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
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
  // Unified search: digits filter by phone; names resolve to phones via the Monday patient index
  const [searchQ, setSearchQ] = useState('');
  const [nameMatch, setNameMatch] = useState({ phones: [], names: [], loading: false });
  const [phoneNames, setPhoneNames] = useState({}); // contact -> patient name (bulk-resolved)
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [elenaLabels, setElenaLabels] = useState({}); // contact -> {urgency,label,reason,priority}
  const [organizing, setOrganizing] = useState(false);
  const [organizedAt, setOrganizedAt] = useState(null);
  const listRef = useRef(null);
  const detailRef = useRef(null);

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

  // Opening a conversation lands at the BOTTOM — most recent texts first in view
  useEffect(() => {
    if (!selected) return;
    requestAnimationFrame(() => {
      const el = detailRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [selected?.contact, selected?.messages?.length]);

  // Bulk-resolve every contact's patient name in ONE request (in-memory index on backend)
  useEffect(() => {
    const phones = [...new Set(
      conversations.map(c => c.contact).filter(c => (c || '').replace(/\D/g, '').length >= 10)
    )];
    if (!phones.length) return;
    api.mondayResolvePhones(phones)
      .then(res => setPhoneNames(res.names || {}))
      .catch(() => {});
  }, [conversations.length]);

  // Name search → resolve to phones via Monday patient index (debounced)
  useEffect(() => {
    const q = searchQ.trim();
    const digits = q.replace(/\D/g, '');
    const isNameSearch = q.length >= 2 && digits.length < 3;
    if (!isNameSearch) {
      setNameMatch({ phones: [], names: [], loading: false });
      return;
    }
    setNameMatch(prev => ({ ...prev, loading: true }));
    const t = setTimeout(async () => {
      try {
        const res = await api.mondaySearch(q);
        const phones = new Set();
        const names = new Set();
        for (const r of res.results || []) {
          names.add(r.name);
          for (const p of r.phones || []) phones.add(p);
        }
        setNameMatch({ phones: [...phones], names: [...names].slice(0, 5), loading: false });
      } catch {
        setNameMatch({ phones: [], names: [], loading: false });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  // Mark a conversation's unread texts as read (processed) — same as email
  async function markConvoProcessed(convo) {
    const unreadIds = (convo.messages || []).filter(m => m.readStatus === 'Unread' && m.id && !String(m.id).startsWith('local-')).map(m => m.id);
    const apply = (c) => ({ ...c, unread: 0, messages: (c.messages || []).map(m => ({ ...m, readStatus: 'Read' })) });
    setConversations(prev => {
      const next = prev.map(c => c.contact === convo.contact ? apply(c) : c);
      writeConvoCache(next);
      return next;
    });
    setSelected(prev => prev && prev.contact === convo.contact ? apply(prev) : prev);
    if (unreadIds.length) {
      try { await api.rcMarkRead(unreadIds); } catch (e) { console.error('Mark read failed:', e); }
    }
  }

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

  // Apply the unified search filter
  const q = searchQ.trim();
  const qDigits = q.replace(/\D/g, '');
  const searching = q.length >= 2;
  const filtered = !searching ? sorted : sorted.filter(c => {
    const contactDigits = (c.contact || '').replace(/\D/g, '');
    // Phone-style query: digits substring match
    if (qDigits.length >= 3) return contactDigits.includes(qDigits);
    // Name query: matches a phone on file for that patient, the resolved list name, or the contact text
    const last10 = contactDigits.slice(-10);
    return nameMatch.phones.includes(last10)
      || (phoneNames[c.contact] || '').toLowerCase().includes(q.toLowerCase())
      || (c.contact || '').toLowerCase().includes(q.toLowerCase());
  });

  const visible = searching ? filtered : filtered.slice(0, visibleCount);
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

      <div className="flex items-center gap-3 flex-wrap">
        <OrganizeButton onClick={handleOrganize} loading={organizing} count={unreadLabels.length} organizedAt={organizedAt} />
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-200/40" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search by name or number..."
            className="input pl-9 w-full"
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200/40 hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>
        {searching && nameMatch.loading && (
          <span className="flex items-center gap-1.5 text-xs text-surface-200/40">
            <Loader size={11} className="animate-spin" /> Matching patients...
          </span>
        )}
        {searching && !nameMatch.loading && nameMatch.names.length > 0 && (
          <span className="text-xs text-surface-200/40">
            Matched: <span className="text-brand-400">{nameMatch.names.join(', ')}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div ref={listRef} onScroll={handleScroll} className="lg:col-span-2 card max-h-[70vh] overflow-y-auto p-0" data-focus-group>
          {loading && <div className="p-4 flex justify-center"><Loader size={18} className="animate-spin text-brand-500" /></div>}
          {conversations.length === 0 && !loading && (
            <p className="text-sm text-surface-200/40 p-4">No conversations found.</p>
          )}
          {conversations.length > 0 && searching && visible.length === 0 && !nameMatch.loading && (
            <p className="text-sm text-surface-200/40 p-4">No conversations match "{q}".</p>
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
                  <div className="flex items-center gap-2 min-w-0">
                    {unread && <span className="w-2 h-2 bg-green-400 rounded-full shrink-0" />}
                    <span className={`text-sm truncate ${unread ? 'font-semibold' : ''}`}>
                      {phoneNames[convo.contact] || convo.contact}
                    </span>
                    {phoneNames[convo.contact] && (
                      <span className="text-[10px] text-surface-200/30 shrink-0">{convo.contact}</span>
                    )}
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
          {!loading && !searching && visibleCount < filtered.length && (
            <button onClick={() => setVisibleCount(v => v + PAGE_SIZE)} className="w-full p-3 text-xs text-brand-400 hover:bg-surface-200/5 transition">
              Show more ({filtered.length - visibleCount} remaining)...
            </button>
          )}
          {!loading && !searching && conversations.length > 0 && visibleCount >= filtered.length && (
            <p className="p-3 text-center text-[10px] text-surface-200/25">All conversations shown</p>
          )}
        </div>

        <div ref={detailRef} className="lg:col-span-3 card max-h-[70vh] overflow-y-auto">
          {!selected ? (
            <p className="text-surface-200/40 text-sm py-8 text-center">Select a conversation to view</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-surface-200/10">
                <div className="flex items-center gap-2 min-w-0">
                  <ConvoHeader contact={selected.contact} />
                  {elenaLabels[selected.contact] && <span className="shrink-0"><ElenaBadge info={elenaLabels[selected.contact]} /></span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isUnreadConvo(selected) && (
                    <button onClick={() => markConvoProcessed(selected)} className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-good/15 text-good hover:bg-good/25 transition">
                      <CheckCircle2 size={12} /> Mark Processed
                    </button>
                  )}
                  <button onClick={() => summarizeConvo(selected.contact)} disabled={summaryLoading} className="btn-secondary text-xs flex items-center gap-1">
                    {summaryLoading ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    Summarize
                  </button>
                </div>
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

              <SmsReplyBox
                key={selected.contact}
                contact={selected.contact}
                lastInboundText={(selected.messages || []).find(m => m.direction === 'Inbound')?.text || ''}
                onSent={(sentText) => {
                  // Replying = processed: mark the convo's unreads read, then append the sent text
                  markConvoProcessed(selected);
                  const newMsg = { id: `local-${Date.now()}`, direction: 'Outbound', text: sentText, time: new Date().toISOString(), readStatus: 'Read' };
                  setSelected(prev => prev ? { ...prev, messages: [newMsg, ...(prev.messages || [])], lastMessageTime: newMsg.time } : prev);
                  setConversations(prev => prev.map(c => c.contact === selected.contact
                    ? { ...c, messages: [newMsg, ...(c.messages || [])], lastMessageTime: newMsg.time }
                    : c));
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
