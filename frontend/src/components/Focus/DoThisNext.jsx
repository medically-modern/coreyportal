import React, { useState, useMemo } from 'react';
import { Mail, Phone, MessageSquare, HelpCircle, ChevronRight, Clock, Zap, SkipForward, CheckCircle2, AlarmClock } from 'lucide-react';

function getUrgencyScore(item) {
  let score = 0;
  // Recency: newer = higher
  if (item.time) {
    const match = item.time.match(/(\d+)(m|h|d)/);
    if (match) {
      const [, num, unit] = match;
      const mins = unit === 'm' ? +num : unit === 'h' ? +num * 60 : +num * 1440;
      score += Math.max(0, 100 - mins); // newer = higher score
    }
  }
  // Urgency flag
  if (item.urgent) score += 50;
  // Keywords
  if (/urgent|ASAP|escalat|emergency|critical/i.test(item.text)) score += 30;
  return score;
}

const CHANNEL_META = {
  email: { icon: Mail, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Email' },
  slack: { icon: MessageSquare, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Slack' },
  rc: { icon: Phone, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Texts & Calls' },
  qa: { icon: HelpCircle, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'Team Questions' },
};

export default function DoThisNext({ emailData, slackData, rcData, questions, onDismiss, onNavigate }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [snoozed, setSnoozed] = useState(new Set());
  const [completed, setCompleted] = useState(new Set());
  const [showDone, setShowDone] = useState(false);

  // Build unified, ranked queue
  const allItems = useMemo(() => {
    const items = [];
    (emailData?.items || []).forEach((item, i) => {
      items.push({ ...item, channel: 'email', id: `email-${i}` });
    });
    (slackData?.items || []).forEach((item, i) => {
      items.push({ ...item, channel: 'slack', id: `slack-${i}` });
    });
    (rcData?.items || []).forEach((item, i) => {
      items.push({ ...item, channel: 'rc', id: `rc-${i}` });
    });
    (questions || []).forEach((q, i) => {
      items.push({
        text: q.question,
        time: '',
        urgent: q.urgency === 'emergency' || q.urgency === 'super_high' || q.urgency === 'high',
        channel: 'qa',
        id: `qa-${i}`,
        from: q.from,
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

  function handleSnooze() {
    setSnoozed(prev => new Set(prev).add(current.id));
    // Un-snooze after 30 min
    setTimeout(() => {
      setSnoozed(prev => {
        const next = new Set(prev);
        next.delete(current.id);
        return next;
      });
    }, 30 * 60 * 1000);
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
        {/* Channel badge */}
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
          {current.time && (
            <span className="text-xs text-surface-200/30 ml-auto flex items-center gap-1">
              <Clock size={10} /> {current.time}
            </span>
          )}
        </div>

        {/* Content */}
        <p className="text-lg font-medium text-white leading-relaxed mb-1">{current.text}</p>
        {current.from && (
          <p className="text-sm text-surface-200/40">From: {current.from}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() => onNavigate?.(channelPath)}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            Open & Handle <ChevronRight size={16} />
          </button>
          <button
            onClick={handleComplete}
            className="px-4 py-3 bg-good/20 text-good rounded-xl hover:bg-good/30 transition"
            title="Mark as handled"
          >
            <CheckCircle2 size={20} />
          </button>
          <button
            onClick={handleSnooze}
            className="px-4 py-3 bg-surface-200/10 text-surface-200/50 rounded-xl hover:bg-surface-200/15 hover:text-amber-400 transition"
            title="Snooze 30 min"
          >
            <AlarmClock size={20} />
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-3 bg-surface-200/10 text-surface-200/50 rounded-xl hover:bg-surface-200/15 hover:text-surface-200/70 transition"
            title="Skip"
          >
            <SkipForward size={20} />
          </button>
        </div>
      </div>

      {/* Upcoming peek */}
      {activeItems.length > 1 && (
        <div className="opacity-40 pointer-events-none">
          <div className={`rounded-2xl border ${CHANNEL_META[activeItems[1].channel].border} ${CHANNEL_META[activeItems[1].channel].bg} p-4`}>
            <div className="flex items-center gap-2">
              {React.createElement(CHANNEL_META[activeItems[1].channel].icon, { size: 14, className: CHANNEL_META[activeItems[1].channel].color })}
              <span className="text-sm text-surface-200/50 truncate">{activeItems[1].text}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
