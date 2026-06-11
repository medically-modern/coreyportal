import React, { useState, useEffect, useRef } from 'react';
import { Loader, AlertTriangle } from 'lucide-react';
import { onApiActivity } from '../../services/api';

// Small bottom-right indicator that appears whenever an API call is in flight.
// Sits left of the Parking Lot bubble. Muted on purpose — informative, not distracting.
const MAX_VISIBLE = 3;
const ERROR_LINGER_MS = 2500;

export default function ApiActivityIndicator() {
  const [active, setActive] = useState([]);   // [{id, label}]
  const [errors, setErrors] = useState([]);   // [{id, label}] — linger briefly
  const activeRef = useRef([]);

  useEffect(() => {
    const off = onApiActivity((evt) => {
      if (evt.type === 'start') {
        activeRef.current = [...activeRef.current, { id: evt.id, label: evt.label }];
        setActive(activeRef.current);
      } else if (evt.type === 'end') {
        const ended = activeRef.current.find(a => a.id === evt.id);
        activeRef.current = activeRef.current.filter(a => a.id !== evt.id);
        setActive(activeRef.current);
        if (evt.error && ended) {
          setErrors(prev => [...prev, ended]);
          setTimeout(() => {
            setErrors(prev => prev.filter(e => e.id !== ended.id));
          }, ERROR_LINGER_MS);
        }
      }
    });
    return off;
  }, []);

  if (active.length === 0 && errors.length === 0) return null;

  // Collapse duplicate labels ("Loading email..." x3 → one row)
  const seen = new Set();
  const rows = [];
  for (const a of active) {
    if (!seen.has(a.label)) { seen.add(a.label); rows.push(a); }
  }
  const visible = rows.slice(0, MAX_VISIBLE);
  const hidden = rows.length - visible.length;

  return (
    <div className="fixed bottom-6 right-24 z-40 flex flex-col items-end gap-1.5 pointer-events-none">
      {errors.map(e => (
        <div key={`err-${e.id}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-800/95 border border-urgent/30 shadow-lg shadow-black/20 animate-slide-up">
          <AlertTriangle size={10} className="text-urgent" />
          <span className="text-[11px] text-urgent/90">{e.label.replace('...', '')} failed</span>
        </div>
      ))}
      {visible.map(a => (
        <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-800/95 border border-surface-200/10 shadow-lg shadow-black/20 animate-slide-up">
          <Loader size={10} className="animate-spin text-brand-400" />
          <span className="text-[11px] text-surface-200/60">{a.label}</span>
        </div>
      ))}
      {hidden > 0 && (
        <span className="text-[10px] text-surface-200/30 pr-1">+{hidden} more</span>
      )}
    </div>
  );
}
