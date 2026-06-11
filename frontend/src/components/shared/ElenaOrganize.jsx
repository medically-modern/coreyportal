import React from 'react';
import { Loader, ChevronDown, ChevronUp } from 'lucide-react';
import ElenaLogo from './ElenaLogo';

// One meaning per color, everywhere:
// red = do now · amber = today · blue = can wait · neutral = fyi
export const URGENCY_META = {
  do_now:   { label: 'Do Now',   chip: 'bg-urgent/20 text-urgent border-urgent/30',  dot: 'bg-urgent' },
  today:    { label: 'Today',    chip: 'bg-warn/20 text-warn border-warn/30',        dot: 'bg-warn' },
  can_wait: { label: 'Can Wait', chip: 'bg-blue-500/15 text-blue-400 border-blue-500/25', dot: 'bg-blue-400' },
  fyi:      { label: 'FYI',      chip: 'bg-surface-200/10 text-surface-200/50 border-surface-200/15', dot: 'bg-surface-200/40' },
};

export function ElenaBadge({ info, compact = false }) {
  if (!info) return null;
  const u = URGENCY_META[info.urgency] || URGENCY_META.today;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${u.chip}`} title={info.reason || ''}>
      <span className={`w-1.5 h-1.5 rounded-full ${u.dot}`} />
      {u.label}{!compact && info.label ? ` · ${info.label}` : ''}
    </span>
  );
}

export function OrganizeButton({ onClick, loading, count, organizedAt }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 text-xs font-medium transition disabled:opacity-50"
        title="Elena reads every unread item and ranks them by priority"
      >
        {loading ? <Loader size={12} className="animate-spin" /> : <ElenaLogo size={14} />}
        {loading ? 'Elena is reading...' : 'Have Elena Organize'}
      </button>
      {organizedAt && !loading && (
        <span className="text-[10px] text-surface-200/30">
          {count > 0 ? `${count} labeled` : 'organized'} · saved
        </span>
      )}
    </div>
  );
}

// Collapsible "Elena's priority order" panel listing unreads top-down
export function PriorityPanel({ labels, itemLookup, open, onToggle, onSelect }) {
  if (!labels?.length) return null;
  return (
    <div className="rounded-xl border border-brand-600/20 bg-brand-600/5 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-brand-600/10 transition">
        <ElenaLogo size={16} />
        <span className="text-sm font-semibold text-brand-400">Elena's priority order</span>
        <span className="text-xs text-surface-200/40">({labels.length} unread)</span>
        {open ? <ChevronUp size={14} className="ml-auto text-surface-200/40" /> : <ChevronDown size={14} className="ml-auto text-surface-200/40" />}
      </button>
      {open && (
        <div className="divide-y divide-surface-200/5">
          {labels.map((l, i) => {
            const item = itemLookup?.(l.id);
            const u = URGENCY_META[l.urgency] || URGENCY_META.today;
            return (
              <div
                key={l.id}
                onClick={() => item && onSelect?.(item)}
                className={`flex items-start gap-3 px-4 py-2.5 ${item ? 'cursor-pointer hover:bg-surface-200/5' : 'opacity-50'} transition`}
              >
                <span className="text-xs font-mono text-surface-200/30 pt-0.5 w-5 shrink-0">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ElenaBadge info={l} compact />
                    <span className="text-sm font-medium truncate">{item?.title || l.id}</span>
                  </div>
                  {l.reason && <p className="text-xs text-surface-200/40 mt-0.5">{l.reason}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
