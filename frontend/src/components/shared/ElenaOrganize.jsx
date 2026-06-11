import React from 'react';
import { Loader } from 'lucide-react';
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
