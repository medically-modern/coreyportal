import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock, X, ArrowLeft, Mail, MessageSquare, Phone, HelpCircle } from 'lucide-react';

const VIEW_LABELS = {
  '/gmail': 'Email',
  '/slack': 'Slack',
  '/ringcentral': 'Texts & Calls',
  '/questions': 'Team Questions',
  '/assistant': 'Elena',
};

const THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const REMINDER_INTERVAL = 10 * 60 * 1000; // re-remind every 10 min after first

export default function HyperfocusGuard({ pendingCounts = {} }) {
  const location = useLocation();
  const [toast, setToast] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const enteredAt = useRef(Date.now());
  const timerRef = useRef(null);
  const path = location.pathname;

  useEffect(() => {
    // Reset on route change
    enteredAt.current = Date.now();
    setToast(null);
    setDismissed(false);

    // Don't guard the dashboard
    if (path === '/') return;

    const label = VIEW_LABELS[path];
    if (!label) return;

    function check() {
      const elapsed = Date.now() - enteredAt.current;
      if (elapsed >= THRESHOLD_MS) {
        const mins = Math.round(elapsed / 60000);

        // Build "what else" summary
        const others = Object.entries(pendingCounts)
          .filter(([key]) => key !== path)
          .filter(([, count]) => count > 0)
          .map(([key, count]) => `${VIEW_LABELS[key] || key}: ${count}`)
          .join(', ');

        setToast({
          minutes: mins,
          view: label,
          others: others || null,
        });
      }
    }

    timerRef.current = setInterval(check, 60000); // check every minute
    // Also set initial check at threshold
    const initialTimer = setTimeout(check, THRESHOLD_MS);

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(initialTimer);
    };
  }, [path, pendingCounts]);

  if (!toast || dismissed) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40 max-w-sm animate-slide-up">
      <div className="bg-surface-800 border border-amber-500/30 rounded-xl shadow-lg shadow-black/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Clock size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-400">
                {toast.minutes} min in {toast.view}
              </p>
              {toast.others && (
                <p className="text-xs text-surface-200/50 mt-1">
                  Still waiting: {toast.others}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-surface-200/30 hover:text-white shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
