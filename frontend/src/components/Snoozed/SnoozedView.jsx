import React, { useState, useEffect } from 'react';
import { AlarmClock, Mail, Phone, MessageSquare, HelpCircle, Sunrise, CheckCircle2 } from 'lucide-react';
import { snoozedList, wakeItem, subscribeSnooze } from '../../utils/snoozeStore';
import { fmtSmartET } from '../../utils/time';

const CHANNEL_META = {
  email: { icon: Mail, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Email' },
  rc: { icon: Phone, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', label: 'Text' },
  qa: { icon: HelpCircle, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', label: 'Team Question' },
  slack: { icon: MessageSquare, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Slack' },
};

function timeUntil(ts) {
  const ms = ts - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

export default function SnoozedView() {
  const [items, setItems] = useState(snoozedList());

  useEffect(() => {
    const unsub = subscribeSnooze(() => setItems(snoozedList()));
    // Tick every 30s so countdowns stay fresh and woken items disappear
    const t = setInterval(() => setItems(snoozedList()), 30 * 1000);
    return () => { unsub(); clearInterval(t); };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <AlarmClock size={20} className="text-amber-400" /> Snoozed
          <span className="text-sm font-normal text-surface-200/40">({items.length} waiting)</span>
        </h1>
        <p className="text-sm text-surface-200/40 mt-1">
          Items you snoozed. They return to your dashboard queue automatically when their time is up.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-good/20 bg-good/5 p-8 text-center">
          <CheckCircle2 size={40} className="mx-auto text-good mb-3" />
          <h2 className="text-lg font-bold mb-1">Nothing snoozed</h2>
          <p className="text-surface-200/50 text-sm">Snooze items from the dashboard or Team Questions and they'll wait here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const meta = CHANNEL_META[item.channel] || CHANNEL_META.slack;
            const Icon = meta.icon;
            return (
              <div key={item.key} className={`flex items-center gap-4 rounded-xl border ${meta.bg} p-4`}>
                <div className="w-9 h-9 rounded-lg bg-surface-900/40 flex items-center justify-center shrink-0">
                  <Icon size={17} className={meta.color} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
                    {item.from && <span className="text-xs text-surface-200/40 truncate">from {item.from}</span>}
                  </div>
                  <p className="text-sm font-medium truncate mt-0.5">{item.title || '(no subject)'}</p>
                  <p className="text-xs text-surface-200/40 mt-1">
                    Snoozed {fmtSmartET(item.snoozedAt)}
                    <span className="mx-1.5 text-surface-200/20">·</span>
                    Returns {fmtSmartET(item.returnsAt)}
                    <span className="ml-1.5 text-amber-400/80">(in {timeUntil(item.returnsAt)})</span>
                  </p>
                </div>

                <button
                  onClick={() => wakeItem(item.key)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 text-xs font-medium transition shrink-0"
                  title="Wake now — send back to the active queue immediately"
                >
                  <Sunrise size={14} /> Wake now
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
