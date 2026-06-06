import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Mail, Phone, MessageSquare, HelpCircle, ChevronRight, Clock, Zap, SkipForward, CheckCircle2, AlarmClock, Bot, Loader, X } from 'lucide-react';
import { api } from '../../services/api';

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

export default function DoThisNext({ emailData, slackData, rcData, questions, onDismiss, onNavigate }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [snoozed, setSnoozed] = useState(new Map()); // id -> unsnooze timeout
  const [completed, setCompleted] = useState(new Set());
  const [showDone, setShowDone] = useState(false);
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);
  const [elenaContext, setElenaContext] = useState(null);
  const [elenaStructured, setElenaStructured] = useState(null);
  const [elenaLoading, setElenaLoading] = useState(false);
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
      const contactMatch = item.text?.match(/^([^:]+): (.*)$/);
      items.push({
        ...item,
        channel: 'rc',
        id: `rc-${i}`,
        from: contactMatch ? contactMatch[1] : 'Unknown',
        subject: contactMatch ? contactMatch[2] : item.text,
        snippet: item.text || '',
      });
    });
    (questions || []).forEach((q, i) => {
      items.push({
        text: q.question,
        time: '',
        urgent: q.urgency === 'emergency' || q.urgency === 'super_high' || q.urgency === 'high',
        channel: 'qa',
        id: `qa-${i}`,
        from: q.from_name || q.from || 'Team',
        subject: q.headline || q.question?.split('\n')[0]?.slice(0, 80) || '',
        snippet: q.question || '',
        tag: q.tag,
        urgencyLabel: q.urgency || q.priority || 'normal',
      });
    });
    return items.sort((a, b) => getUrgencyScore(b) - getUrgencyScore(a));
  }, [emailData, slackData, rcData, questions]);

  const activeItems = allItems.filter(item =>
    !dismissed.has(item.id) && !snoozed.has(item.id) && !completed.has(item.id)
  );

  const current = activeItems[0];
  const totalHandled = completed.size + dismissed.size;
  const total = allItems.length;

  // Fetch Elena context when current item changes
  useEffect(() => {
    if (!current || current.id === lastContextId.current) return;
    lastContextId.current = current.id;
    setElenaContext(null);
    setElenaStructured(null);
    setElenaLoading(true);
    api.focusContext({
      channel: current.channel,
      from: current.from,
      subject: current.subject,
      text: current.snippet,
      time: current.time,
      urgent: current.urgent,
    }).then(res => {
      setElenaContext(res.context);
      setElenaStructured(res.structured || null);
    }).catch(() => {
      setElenaContext(null);
      setElenaStructured(null);
    }).finally(() => {
      setElenaLoading(false);
    });
  }, [current?.id]);

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

  function handleComplete() {
    setCompleted(prev => new Set(prev).add(current.id));
    setShowDone(true);
    setTimeout(() => setShowDone(false), 800);
  }

  function handleDismiss() {
    setDismissed(prev => new Set(prev).add(current.id));
  }

  function handleSnooze(durationMs) {
    const id = current.id;
    setSnoozed(prev => new Map(prev).set(id, true));
    setTimeout(() => {
      setSnoozed(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }, durationMs);
  }

  const channelPath = { email: '/gmail', slack: '/slack', rc: '/ringcentral', qa: '/questions' }[current.channel];

  return (
    <div className="space-y-4">
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
            <p className="text-xs text-surface-200/40">
              From: <span className="text-surface-200/70 font-medium">{current.from}</span>
              {current.tag && <span className="ml-2 text-surface-200/30">· {current.tag}</span>}
            </p>
          )}
          {current.subject && current.subject !== current.snippet && (
            <p className="text-lg font-semibold text-white leading-snug">{current.subject}</p>
          )}
          <p className={`${current.subject && current.subject !== current.snippet ? 'text-sm text-surface-200/60' : 'text-lg font-medium text-white'} leading-relaxed`}>
            {current.snippet?.length > 200 ? current.snippet.slice(0, 200) + '...' : current.snippet}
          </p>
        </div>

        {/* Elena's context + recommendation */}
        <div className="rounded-xl bg-surface-900/40 border border-brand-600/20 p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={14} className="text-brand-400" />
            <span className="text-xs font-semibold text-brand-400">Elena's Take</span>
          </div>
          {elenaLoading ? (
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
            </div>
          ) : elenaContext ? (
            <p className="text-sm text-surface-200/70 leading-relaxed">{elenaContext}</p>
          ) : (
            <p className="text-sm text-surface-200/30 italic">Context unavailable</p>
          )}
        </div>

        {/* Actions with labels */}
        <div className="flex items-stretch gap-3">
          <button
            onClick={() => onNavigate?.(channelPath)}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            Open <ChevronRight size={16} />
          </button>

          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleComplete}
              className="px-4 py-2.5 bg-good/20 text-good rounded-xl hover:bg-good/30 transition"
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
              className="px-4 py-2.5 bg-surface-200/10 text-surface-200/50 rounded-xl hover:bg-amber-500/20 hover:text-amber-400 transition"
              title="Snooze"
            >
              <AlarmClock size={18} />
            </button>
            <span className="text-[9px] text-surface-200/30">Snooze</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 bg-surface-200/10 text-surface-200/50 rounded-xl hover:bg-surface-200/15 hover:text-surface-200/70 transition"
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
