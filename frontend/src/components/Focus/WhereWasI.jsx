import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Undo2, X } from 'lucide-react';

const STORAGE_KEY = 'corey-resume-state';

const VIEW_LABELS = {
  '/': 'Dashboard',
  '/gmail': 'Email',
  '/slack': 'Slack',
  '/ringcentral': 'Texts & Calls',
  '/questions': 'Team Questions',
  '/assistant': 'Elena',
};

function saveState(path) {
  if (path === '/') return; // Don't save dashboard as resume target
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    path,
    label: VIEW_LABELS[path] || path,
    timestamp: Date.now(),
  }));
}

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!data) return null;
    // Only show if saved within last 4 hours
    if (Date.now() - data.timestamp > 4 * 60 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}

export default function WhereWasI() {
  const location = useLocation();
  const navigate = useNavigate();
  const [resumeState, setResumeState] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  // Save current location for future sessions
  useEffect(() => {
    saveState(location.pathname);
  }, [location.pathname]);

  // On mount (dashboard load), check for resume state
  useEffect(() => {
    if (hasShown) return;
    if (location.pathname !== '/') return;
    const saved = loadState();
    if (saved && saved.path !== '/') {
      setResumeState(saved);
      setHasShown(true);
    }
  }, [location.pathname, hasShown]);

  if (!resumeState || dismissed || location.pathname !== '/') return null;

  const minutesAgo = Math.round((Date.now() - resumeState.timestamp) / 60000);
  const timeLabel = minutesAgo < 60
    ? `${minutesAgo}m ago`
    : `${Math.round(minutesAgo / 60)}h ago`;

  return (
    <div className="bg-brand-600/10 border border-brand-600/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-slide-down">
      <div className="flex items-center gap-3">
        <Undo2 size={16} className="text-brand-400 shrink-0" />
        <p className="text-sm text-surface-200/70">
          You were in <span className="font-semibold text-white">{resumeState.label}</span>
          <span className="text-surface-200/30 ml-1">({timeLabel})</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { navigate(resumeState.path); setDismissed(true); }}
          className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition"
        >
          Go back
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-surface-200/30 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
