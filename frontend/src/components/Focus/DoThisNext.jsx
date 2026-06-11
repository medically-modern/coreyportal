import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Mail, Phone, MessageSquare, HelpCircle, ChevronRight, Clock, Zap, SkipForward, CheckCircle2, AlarmClock, Loader, X, Send, Eraser, MessageCircle, ExternalLink, ArrowDown, ArrowUp, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import ElenaLogo from '../shared/ElenaLogo';
import { fmtSmartET } from '../../utils/time';
import { usePatientName } from '../../hooks/usePatientName';
import { snoozeItem, isSnoozed, snoozeKeyFor, subscribeSnooze } from '../../utils/snoozeStore';

// Header for texts — patient name BIG over the whole card, phone stays small
function TextHeader({ phone, tag }) {
  const name = usePatientName(phone);
  return (
    <div className="pb-1">
      <h2 className="text-2xl font-bold text-white leading-tight">{name || phone}</h2>
      <p className="text-xs text-surface-200/40 mt-0.5">
        {name && <span>{phone}</span>}
        {name && tag && <span> · </span>}
        {tag && <span>{tag}</span>}
      </p>
    </div>
  );
}

// ── Elena take cache (localStorage) ──
const TAKE_CACHE_KEY = 'corey-elena-takes';
const TAKE_CACHE_MAX_AGE = 4 * 60 * 60 * 1000; // 4 hours

function getTakeCache() {
  try {
    const raw = localStorage.getItem(TAKE_CACHE_KEY);
    if (!raw) return {};
    const cache = JSON.parse(raw);
    // Prune expired entries
    const now = Date.now();
    const pruned = {};
    for (const [key, val] of Object.entries(cache)) {
      if (val.time && (now - val.time < TAKE_CACHE_MAX_AGE)) pruned[key] = val;
    }
    return pruned;
  } catch { return {}; }
}

function setTakeCache(itemId, data) {
  try {
    const cache = getTakeCache();
    cache[itemId] = { ...data, time: Date.now() };
    // Keep max 50 entries
    const entries = Object.entries(cache).sort((a, b) => b[1].time - a[1].time).slice(0, 50);
    localStorage.setItem(TAKE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

function getCachedTake(itemId) {
  const cache = getTakeCache();
  return cache[itemId] || null;
}

function getUrgencyScore(item) {
  let score = 0;
  if (item.time) {
    const match = item.time.match(/(\d+)(m|h|d)/);
    if (match) {
      const [, num, unit] = match;
      const mins = unit === 'm' ? +num : unit === 'h' ? +num * 60 : +num * 1440;
      score += Math.max(0, 100 - mins);
    }
  }
  if (item.urgent) score += 50;
  if (/urgent|ASAP|escalat|emergency|critical/i.test(item.text)) score += 30;
  return score;
}

const CHANNEL_META = {
  email: { icon: Mail, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Email' },
  slack: { icon: MessageSquare, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Slack' },
  rc: { icon: Phone, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Texts & Calls' },
  qa: { icon: HelpCircle, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'Team Questions' },
};

const SNOOZE_OPTIONS = [
  { label: '30m', ms: 30 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '2h', ms: 2 * 60 * 60 * 1000 },
  { label: '4h', ms: 4 * 60 * 60 * 1000 },
  { label: 'Tomorrow', ms: 24 * 60 * 60 * 1000 },
];

function SnoozePicker({ onSnooze, onClose }) {
  return (
    <div className="absolute bottom-full mb-2 right-0 bg-surface-800 border border-surface-200/20 rounded-xl shadow-xl shadow-black/30 p-2 z-10 animate-slide-up">
      <p className="text-[10px] text-surface-200/30 uppercase tracking-wider px-2 py-1">Snooze for...</p>
      <div className="flex gap-1">
        {SNOOZE_OPTIONS.map(opt => (
          <button
            key={opt.label}
            onClick={() => { onSnooze(opt.ms); onClose(); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface-200/10 text-surface-200/60 hover:bg-amber-500/20 hover:text-amber-400 transition whitespace-nowrap"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Conversation Side Panel (texts) ──
function ConversationPanel({ phoneNumber, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const patientName = usePatientName(phoneNumber);

  useEffect(() => {
    if (!phoneNumber) return;
    setLoading(true);
    setError(null);
    api.rcFullConversation(phoneNumber)
      .then(res => {
        setMessages(res.messages || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [phoneNumber]);

  useEffect(() => {
    if (messages.length > 0 && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  function formatTime(iso) {
    return fmtSmartET(iso);
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-surface-900 border-l border-surface-200/10 z-50 flex flex-col shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200/10">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-green-400" />
          <span className="text-sm font-semibold text-white">{patientName || 'Conversation'}</span>
          <span className="text-xs text-surface-200/40">{phoneNumber}</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200/10 text-surface-200/50 hover:text-white transition">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-surface-200/40">
            <Loader size={16} className="animate-spin mr-2" /> Loading history...
          </div>
        ) : error ? (
          <div className="text-center py-8 text-bad/70 text-sm">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-surface-200/30 text-sm">No messages found</div>
        ) : (
          <>
            <p className="text-center text-[10px] text-surface-200/20 py-2">{messages.length} messages</p>
            {messages.map((msg, i) => {
              const isUs = msg.direction === 'Outbound';
              return (
                <div key={i} className={`flex ${isUs ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    isUs
                      ? 'bg-brand-600/30 text-white rounded-br-md'
                      : 'bg-surface-200/10 text-surface-200/80 rounded-bl-md'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text || '(no text)'}</p>
                    <p className={`text-[10px] mt-1 ${isUs ? 'text-brand-400/50' : 'text-surface-200/25'}`}>
                      {formatTime(msg.time)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Inline conversation thread (texts) — auto-loads into the card ──
// Shows the recent back-and-forth immediately; scroll up for full history.
function InlineConversation({ phoneNumber, fallbackText }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setMessages([]);
    api.rcFullConversation(phoneNumber)
      .then(res => { if (!cancelled) setMessages(res.messages || []); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [phoneNumber]);

  // Anchor to the bottom (newest) — scrolling up reveals the full history
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-surface-200/40 py-3">
        <Loader size={12} className="animate-spin" /> Loading conversation...
      </div>
    );
  }

  if (failed || messages.length === 0) {
    return <p className="text-lg font-medium text-white leading-relaxed">{fallbackText}</p>;
  }

  // Most recent inbound message = their latest response → highlighted green
  let lastInboundIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === 'Inbound') { lastInboundIdx = i; break; }
  }

  return (
    <div className="rounded-xl bg-surface-900/40 border border-surface-200/10 overflow-hidden">
      <div ref={scrollRef} className="max-h-64 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.length > 4 && (
          <p className="text-center text-[10px] text-surface-200/25 py-1">
            ↑ scroll up — {messages.length} messages
          </p>
        )}
        {messages.map((msg, i) => {
          const isUs = msg.direction === 'Outbound';
          const isLatestReply = i === lastInboundIdx;
          return (
            <div key={i} className={`flex ${isUs ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 ${
                isUs
                  ? 'bg-brand-600/30 text-white rounded-br-md'
                  : isLatestReply
                    ? 'bg-good/20 border border-good/40 text-white rounded-bl-md'
                    : 'bg-surface-200/10 text-surface-200/80 rounded-bl-md'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text || '(no text)'}</p>
                <p className={`text-[10px] mt-0.5 ${isUs ? 'text-brand-400/50' : isLatestReply ? 'text-good/70' : 'text-surface-200/25'}`}>
                  {fmtSmartET(msg.time)}{isLatestReply ? ' · their latest' : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Reply Compose Area ──
function ReplyCompose({ current, elenaStructured, onSent }) {
  const [replyText, setReplyText] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null); // 'sent' | 'error'
  const textareaRef = useRef(null);

  const isEmail = current.channel === 'email';
  const isText = current.channel === 'rc';
  const showReply = isEmail || isText;

  if (!showReply) return null;

  // Auto-resize textarea
  function handleTextChange(e) {
    setReplyText(e.target.value);
    setSendResult(null);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }

  async function handleDraft() {
    setDrafting(true);
    try {
      const res = await api.draftReply({
        channel: isEmail ? 'email' : 'text',
        originalText: current.snippet || current.text,
        from: current.from,
        subject: current.subject,
      });
      setReplyText(res.draft || '');
      // Focus and auto-resize
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.style.height = 'auto';
          ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
          ta.focus();
        }
      }, 50);
    } catch {
      setReplyText('(Elena couldn\'t draft a reply — write your own)');
    } finally {
      setDrafting(false);
    }
  }

  async function handleSend() {
    if (!replyText.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      if (isEmail) {
        // Extract email address from "Name <email>" format
        const emailMatch = current.from?.match(/<([^>]+)>/) || [null, current.from];
        const toEmail = emailMatch[1] || current.from;
        await api.gmailReply(current.threadId, toEmail, current.subject, replyText.trim());
      } else {
        // SMS — from is the phone number
        await api.rcSendSMS(current.from, replyText.trim());
      }
      setSendResult('sent');
      setReplyText('');
      setTimeout(() => {
        setSendResult(null);
        onSent?.();
      }, 1500);
    } catch (err) {
      console.error('Send error:', err);
      setSendResult('error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface-900/60 border border-surface-200/10 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-surface-200/30 uppercase tracking-wider font-semibold">
          {isEmail ? 'Reply to Email' : 'Reply via Text'}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDraft}
            disabled={drafting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-600/20 text-brand-400 text-xs font-medium hover:bg-brand-600/30 transition disabled:opacity-50"
          >
            {drafting ? <Loader size={10} className="animate-spin" /> : <ElenaLogo size={12} />}
            {drafting ? 'Drafting...' : 'Elena Draft'}
          </button>
          {isText && replyText && (
            <button
              onClick={() => { setReplyText(''); setSendResult(null); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-200/10 text-surface-200/50 text-xs hover:bg-surface-200/15 transition"
            >
              <Eraser size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={replyText}
        onChange={handleTextChange}
        placeholder={isEmail ? 'Write your reply...' : 'Type a message...'}
        rows={2}
        className="w-full bg-surface-800/50 border border-surface-200/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-200/25 resize-none focus:outline-none focus:border-brand-600/40 transition"
      />

      <div className="flex items-center justify-between">
        <div className="text-xs">
          {sendResult === 'sent' && (
            <span className="text-good flex items-center gap-1"><CheckCircle2 size={12} /> Sent!</span>
          )}
          {sendResult === 'error' && (
            <span className="text-bad">Failed to send. Try again.</span>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={!replyText.trim() || sending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {sending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default function DoThisNext({ emailData, slackData, rcData, questions, onDismiss, onNavigate, elenaEnabled = true }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [completed, setCompleted] = useState(new Set());
  const [snoozeTick, setSnoozeTick] = useState(0); // re-render when snoozes change/expire
  const [showDone, setShowDone] = useState(false);
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);
  const [elenaContext, setElenaContext] = useState(null);
  const [elenaStructured, setElenaStructured] = useState(null);
  const [elenaLoading, setElenaLoading] = useState(false);
  const [elenaRequested, setElenaRequested] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const lastContextId = useRef(null);

  // Build unified, ranked queue with RICH data
  const allItems = useMemo(() => {
    const items = [];
    (emailData?.items || []).forEach((item, i) => {
      items.push({
        ...item,
        channel: 'email',
        id: `email-${i}`,
        from: item.from || item.text?.split(':')[0] || 'Unknown',
        subject: item.subject || item.text?.split(': ').slice(1).join(': ') || '',
        snippet: item.snippet || item.text || '',
        threadId: item.threadId || item.id || null,
      });
    });
    (slackData?.items || []).forEach((item, i) => {
      const channelMatch = item.text?.match(/^#(\S+): (.*)$/);
      items.push({
        ...item,
        channel: 'slack',
        id: `slack-${i}`,
        from: channelMatch ? `#${channelMatch[1]}` : 'Slack',
        subject: channelMatch ? channelMatch[2] : item.text,
        snippet: item.text || '',
      });
    });
    (rcData?.items || []).forEach((item, i) => {
      const contactMatch = item.text?.match(/^([^:]+): ([\s\S]*)$/);
      items.push({
        ...item,
        channel: 'rc',
        id: `rc-${i}`,
        from: item.from || (contactMatch ? contactMatch[1] : 'Unknown'),
        subject: item.subject || (contactMatch ? contactMatch[2] : item.text),
        snippet: item.snippet || item.text || '',
      });
    });
    (questions || []).forEach((q, i) => {
      items.push({
        text: q.question,
        time: '',
        urgent: q.urgency === 'emergency' || q.urgency === 'super_high' || q.urgency === 'high',
        channel: 'qa',
        id: `qa-${i}`,
        qaId: q.id,
        from: q.from_name || q.from || 'Team',
        subject: q.headline || q.question?.split('\n')[0]?.slice(0, 80) || '',
        snippet: q.question || '',
        tag: q.tag,
        urgencyLabel: q.urgency || q.priority || 'normal',
      });
    });
    return items.sort((a, b) => getUrgencyScore(b) - getUrgencyScore(a));
  }, [emailData, slackData, rcData, questions]);

  // Re-render when snoozed items change or wake up
  useEffect(() => {
    const unsub = subscribeSnooze(() => setSnoozeTick(t => t + 1));
    const t = setInterval(() => setSnoozeTick(tk => tk + 1), 30 * 1000);
    return () => { unsub(); clearInterval(t); };
  }, []);

  const activeItems = allItems.filter(item =>
    !dismissed.has(item.id) && !completed.has(item.id) && !isSnoozed(snoozeKeyFor(item))
  );

  const current = activeItems[0];
  const totalHandled = completed.size + dismissed.size;
  const total = allItems.length;

  // When current item changes: reset state, load from cache if available
  useEffect(() => {
    setShowConversation(false);
    setElenaContext(null);
    setElenaStructured(null);
    setElenaLoading(false);
    setElenaRequested(false);
    lastContextId.current = current?.id || null;

    if (current?.id) {
      const cached = getCachedTake(current.id);
      if (cached) {
        setElenaContext(cached.context || null);
        setElenaStructured(cached.structured || null);
        setElenaRequested(true);
      }
    }
  }, [current?.id]);

  // Fetch Elena context on demand (button press)
  const fetchElenaTake = useCallback(async () => {
    if (!current) return;
    setElenaLoading(true);
    setElenaRequested(true);
    try {
      const res = await api.focusContext({
        channel: current.channel,
        from: current.from,
        subject: current.subject,
        text: current.snippet,
        time: current.time,
        urgent: current.urgent,
        threadId: current.threadId,
      });
      setElenaContext(res.context);
      setElenaStructured(res.structured || null);
      // Persist to localStorage
      setTakeCache(current.id, {
        context: res.context,
        structured: res.structured || null,
      });
    } catch {
      setElenaContext(null);
      setElenaStructured(null);
    } finally {
      setElenaLoading(false);
    }
  }, [current]);

  if (!current || allItems.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-good/20 bg-good/5 p-8 text-center">
        <CheckCircle2 size={48} className="mx-auto text-good mb-3" />
        <h2 className="text-xl font-bold mb-1">You're caught up!</h2>
        <p className="text-surface-200/50 text-sm">Nothing urgent needs your attention right now.</p>
        {totalHandled > 0 && (
          <p className="text-good text-sm mt-2 font-medium">{totalHandled} items handled this session</p>
        )}
      </div>
    );
  }

  const meta = CHANNEL_META[current.channel];
  const Icon = meta.icon;
  const position = total - activeItems.length + 1;
  const isText = current.channel === 'rc';
  const isEmail = current.channel === 'email';
  const canReply = isEmail || isText;

  function handleComplete() {
    setCompleted(prev => new Set(prev).add(current.id));
    setShowDone(true);
    setTimeout(() => setShowDone(false), 800);
  }

  function handleDismiss() {
    setDismissed(prev => new Set(prev).add(current.id));
  }

  function handleSnooze(durationMs) {
    // Persistent: survives reloads, visible in the Snoozed view, auto-returns
    snoozeItem(snoozeKeyFor(current), {
      channel: current.channel,
      title: current.subject || current.text || '',
      from: current.from || '',
    }, durationMs);
  }

  // Open goes to the EXACT item — specific email thread / specific conversation
  const channelPath =
    current.channel === 'email' && current.threadId ? `/gmail?thread=${current.threadId}` :
    current.channel === 'rc' && current.from ? `/ringcentral?contact=${encodeURIComponent(current.from)}` :
    { email: '/gmail', slack: '/slack', rc: '/ringcentral', qa: '/questions' }[current.channel];

  return (
    <div className="space-y-4">
      {/* Conversation side panel for texts */}
      {showConversation && isText && current.from && (
        <ConversationPanel
          phoneNumber={current.from}
          onClose={() => setShowConversation(false)}
        />
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-surface-200/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-good rounded-full transition-all duration-500"
            style={{ width: `${(totalHandled / Math.max(total, 1)) * 100}%` }}
          />
        </div>
        <span className="text-xs text-surface-200/40 font-mono whitespace-nowrap">
          {position}/{total}
        </span>
      </div>

      {/* Current Card */}
      <div className={`relative rounded-2xl border-2 ${meta.border} ${meta.bg} p-6 transition-all ${showDone ? 'scale-95 opacity-50' : 'scale-100'}`}>
        {/* Channel + urgency header */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center`}>
            <Icon size={16} className={meta.color} />
          </div>
          <span className={`text-xs font-semibold ${meta.color} uppercase tracking-wider`}>{meta.label}</span>
          {current.urgent && (
            <span className="flex items-center gap-1 text-xs bg-urgent/20 text-urgent px-2 py-0.5 rounded-full">
              <Zap size={10} /> Urgent
            </span>
          )}
          {current.urgencyLabel && current.urgencyLabel !== 'normal' && !current.urgent && (
            <span className="text-xs bg-warn/20 text-warn px-2 py-0.5 rounded-full">{current.urgencyLabel}</span>
          )}
          {current.time && (
            <span className="text-xs text-surface-200/30 ml-auto flex items-center gap-1">
              <Clock size={10} /> {current.time}
            </span>
          )}
        </div>

        {/* Rich content */}
        <div className="space-y-2 mb-4">
          {current.from && (
            isText ? (
              <TextHeader phone={current.from} tag={current.tag} />
            ) : (
              <p className="text-xs text-surface-200/40">
                From: <span className="text-surface-200/70 font-medium">{current.from}</span>
                {current.tag && <span className="ml-2 text-surface-200/30">· {current.tag}</span>}
              </p>
            )
          )}
          {isText && current.from ? (
            /* Texts: auto-load the conversation so the recent back-and-forth
               is immediately visible — their latest reply highlighted green */
            <InlineConversation phoneNumber={current.from} fallbackText={current.snippet} />
          ) : (
            <>
              {current.subject && current.subject !== current.snippet && (
                <p className="text-lg font-semibold text-white leading-snug">{current.subject}</p>
              )}
              <p className={`${current.subject && current.subject !== current.snippet ? 'text-sm text-surface-200/60' : 'text-lg font-medium text-white'} leading-relaxed`}>
                {current.snippet?.length > 200 ? current.snippet.slice(0, 200) + '...' : current.snippet}
              </p>
            </>
          )}
        </div>

        {/* Elena's context + recommendation — only when enabled */}
        {elenaEnabled && (
          <div className="rounded-xl bg-surface-900/40 border border-brand-600/20 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ElenaLogo size={16} />
              <span className="text-xs font-semibold text-brand-400">Elena's Take</span>
            </div>

            {/* Not yet requested — show button */}
            {!elenaRequested && !elenaLoading ? (
              <div className="flex items-center gap-3 py-2">
                <button
                  onClick={fetchElenaTake}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 text-sm font-medium transition"
                >
                  <Sparkles size={14} /> Get Elena's Take
                </button>
                <span className="text-xs text-surface-200/25">Analyzes context, history, and patient records</span>
              </div>
            ) : elenaLoading ? (
              <div className="flex items-center gap-2 text-sm text-surface-200/40">
                <Loader size={12} className="animate-spin" />
                Reading context...
              </div>
            ) : elenaStructured ? (
              <div className="space-y-3">
                {/* Urgency badge */}
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    elenaStructured.urgency === 'do_now' ? 'bg-bad/20 text-bad' :
                    elenaStructured.urgency === 'can_wait' ? 'bg-good/20 text-good' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      elenaStructured.urgency === 'do_now' ? 'bg-bad animate-pulse' :
                      elenaStructured.urgency === 'can_wait' ? 'bg-good' :
                      'bg-amber-400'
                    }`} />
                    {elenaStructured.urgency === 'do_now' ? 'Do Now' :
                     elenaStructured.urgency === 'can_wait' ? 'Can Wait' : 'Today'}
                  </span>
                  {elenaStructured.type && elenaStructured.type !== 'patient' && elenaStructured.type !== 'email' && (
                    <span className="ml-2 text-xs text-surface-200/40 capitalize">{elenaStructured.type}</span>
                  )}
                </div>

                {/* Summary */}
                <div>
                  <p className="text-xs font-semibold text-surface-200/40 uppercase tracking-wider mb-1">What's This</p>
                  <p className="text-sm text-surface-200/80 leading-relaxed">{elenaStructured.summary}</p>
                </div>

                {/* Action — visually distinct */}
                {elenaStructured.action && (
                  <div className="rounded-lg bg-brand-600/10 border border-brand-600/20 px-3 py-2.5">
                    <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">Next Step</p>
                    <p className="text-sm text-white font-medium leading-relaxed">{elenaStructured.action}</p>
                  </div>
                )}

                {/* Flags */}
                {elenaStructured.flags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {elenaStructured.flags.map((flag, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                        ⚠ {flag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Refresh take */}
                <button
                  onClick={fetchElenaTake}
                  className="text-[10px] text-surface-200/25 hover:text-brand-400 flex items-center gap-1 transition"
                >
                  <Sparkles size={8} /> Refresh take
                </button>
              </div>
            ) : elenaContext ? (
              <p className="text-sm text-surface-200/70 leading-relaxed">{elenaContext}</p>
            ) : (
              <p className="text-sm text-surface-200/30 italic">Context unavailable</p>
            )}
          </div>
        )}

        {/* Reply compose — for emails and texts */}
        {canReply && (
          <div className="mb-4">
            <ReplyCompose
              current={current}
              elenaStructured={elenaStructured}
              onSent={handleComplete}
            />
          </div>
        )}

        {/* Actions with labels */}
        <div className="flex items-stretch gap-2">
          {/* View Conversation (texts only) */}
          {isText && current.from && (
            <button
              onClick={() => setShowConversation(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                showConversation
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-surface-200/10 text-surface-200/60 hover:bg-green-500/15 hover:text-green-400'
              }`}
              title="View full conversation"
            >
              <MessageCircle size={15} />
              <span className="hidden sm:inline text-xs">History</span>
            </button>
          )}

          {/* Go to Email (emails only) */}
          {isEmail && (
            <button
              onClick={() => onNavigate?.(`/gmail?thread=${current.threadId}`)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-200/10 text-surface-200/60 hover:bg-blue-500/15 hover:text-blue-400 transition text-sm"
              title="Open in email view"
            >
              <ExternalLink size={15} />
              <span className="hidden sm:inline text-xs">View Email</span>
            </button>
          )}

          <button
            onClick={() => onNavigate?.(channelPath)}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            Open <ChevronRight size={16} />
          </button>

          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleComplete}
              className="px-3 py-2.5 bg-good/20 text-good rounded-xl hover:bg-good/30 transition"
              title="Mark as handled"
            >
              <CheckCircle2 size={18} />
            </button>
            <span className="text-[9px] text-surface-200/30">Done</span>
          </div>

          <div className="relative flex flex-col items-center gap-1">
            {showSnoozePicker && (
              <SnoozePicker
                onSnooze={handleSnooze}
                onClose={() => setShowSnoozePicker(false)}
              />
            )}
            <button
              onClick={() => setShowSnoozePicker(prev => !prev)}
              className="px-3 py-2.5 bg-surface-200/10 text-surface-200/50 rounded-xl hover:bg-amber-500/20 hover:text-amber-400 transition"
              title="Snooze"
            >
              <AlarmClock size={18} />
            </button>
            <span className="text-[9px] text-surface-200/30">Snooze</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleDismiss}
              className="px-3 py-2.5 bg-surface-200/10 text-surface-200/50 rounded-xl hover:bg-surface-200/15 hover:text-surface-200/70 transition"
              title="Skip this for now"
            >
              <SkipForward size={18} />
            </button>
            <span className="text-[9px] text-surface-200/30">Skip</span>
          </div>
        </div>
      </div>

      {/* Upcoming peek */}
      {activeItems.length > 1 && (
        <div className="opacity-40 pointer-events-none">
          <div className={`rounded-2xl border ${CHANNEL_META[activeItems[1].channel].border} ${CHANNEL_META[activeItems[1].channel].bg} p-4`}>
            <div className="flex items-center gap-2">
              {React.createElement(CHANNEL_META[activeItems[1].channel].icon, { size: 14, className: CHANNEL_META[activeItems[1].channel].color })}
              <span className="text-xs font-medium text-surface-200/40">{CHANNEL_META[activeItems[1].channel].label}</span>
              <span className="text-sm text-surface-200/50 truncate">
                {activeItems[1].from && `${activeItems[1].from}: `}{activeItems[1].subject || activeItems[1].text}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Focus mode explainer — tiny, dismissible */}
      <FocusModeHint />
    </div>
  );
}

function FocusModeHint() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('corey-focus-hint-dismissed') === 'true');
  if (dismissed) return null;
  return (
    <div className="flex items-center justify-between text-[11px] text-surface-200/25 px-2">
      <span>Focus mode shows one thing at a time so you don't get overwhelmed. Handle it, skip it, or snooze it.</span>
      <button onClick={() => { setDismissed(true); localStorage.setItem('corey-focus-hint-dismissed', 'true'); }} className="hover:text-surface-200/50 ml-2 shrink-0">
        <X size={10} />
      </button>
    </div>
  );
}
