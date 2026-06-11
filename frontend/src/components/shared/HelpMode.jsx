import React, { useState, useEffect, useCallback } from 'react';
import { HelpCircle, X } from 'lucide-react';

// ── F4 Help Mode ──
// Press F4 anywhere: every button/control explains itself on hover.
// Clicks are paused while active (safe to explore). F4 or Esc exits.

const INTERACTIVE = 'button, a, input, textarea, select, [role="button"], [data-help], [title]';

function helpTextFor(el) {
  if (!el) return null;
  const explicit = el.getAttribute('data-help') || el.getAttribute('title') || el.getAttribute('aria-label');
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    return el.placeholder ? `Type here — ${el.placeholder}` : 'Text input';
  }
  if (tag === 'select') return 'Choose an option';
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
  if (text) return text.length > 90 ? `${text.slice(0, 90)}... (click to open)` : text;
  if (tag === 'a') return 'Link';
  return 'Button';
}

export default function HelpMode() {
  const [active, setActive] = useState(false);
  const [tip, setTip] = useState(null); // {x, y, text}

  // F4 toggles; Esc exits
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'F4') {
        e.preventDefault();
        setActive(prev => !prev);
        setTip(null);
      } else if (e.key === 'Escape' && active) {
        setActive(false);
        setTip(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // Outline interactive elements while active
  useEffect(() => {
    document.body.classList.toggle('help-mode', active);
    return () => document.body.classList.remove('help-mode');
  }, [active]);

  // Hover → tooltip
  const onMove = useCallback((e) => {
    const el = e.target.closest?.(INTERACTIVE);
    if (!el || el.closest('[data-help-ui]')) { setTip(null); return; }
    const text = helpTextFor(el);
    if (!text) { setTip(null); return; }
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130);
    const below = r.bottom + 10;
    const y = below > window.innerHeight - 70 ? r.top - 10 : below;
    setTip({ x, y, above: below > window.innerHeight - 70, text });
  }, []);

  // Pause real clicks while exploring (except help-mode's own UI)
  const onClickCapture = useCallback((e) => {
    if (e.target.closest?.('[data-help-ui]')) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!active) return;
    document.addEventListener('mouseover', onMove, true);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      document.removeEventListener('mouseover', onMove, true);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [active, onMove, onClickCapture]);

  if (!active) return null;

  return (
    <>
      {/* Banner */}
      <div data-help-ui className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-800 border-2 border-brand-500/40 shadow-2xl shadow-black/40 animate-slide-down">
        <HelpCircle size={16} className="text-brand-400" />
        <span className="text-sm text-surface-100">
          <span className="font-semibold text-brand-400">Help Mode</span> — hover any button to see what it does. Clicks are paused.
        </span>
        <span className="text-xs text-surface-200/40 bg-surface-200/10 px-2 py-0.5 rounded-md font-mono">F4 to exit</span>
        <button
          data-help-ui
          onClick={() => { setActive(false); setTip(null); }}
          className="text-surface-200/40 hover:text-white transition"
          title="Exit help mode"
        >
          <X size={15} />
        </button>
      </div>

      {/* Hover tooltip */}
      {tip && (
        <div
          className="fixed z-[100] pointer-events-none max-w-[260px] px-3 py-2 rounded-lg bg-surface-800 border border-brand-500/40 shadow-xl shadow-black/40 text-xs text-surface-100 leading-snug text-center"
          style={{
            left: tip.x,
            top: tip.y,
            transform: `translate(-50%, ${tip.above ? '-100%' : '0'})`,
          }}
        >
          {tip.text}
        </div>
      )}
    </>
  );
}
