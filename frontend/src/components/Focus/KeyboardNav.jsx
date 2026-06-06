import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, X } from 'lucide-react';

const SHORTCUTS = [
  { key: '1', label: 'Email', action: '/gmail' },
  { key: '2', label: 'Texts & Calls', action: '/ringcentral' },
  { key: '3', label: 'Slack', action: '/slack' },
  { key: '4', label: 'Team Questions', action: '/questions' },
  { key: '0', label: 'Dashboard', action: '/' },
  { key: 'e', label: 'Elena', action: '/assistant' },
  { key: '/', label: 'Focus search', action: 'search' },
  { key: '?', label: 'Show shortcuts', action: 'help' },
  { key: 'Esc', label: 'Close panel', action: 'escape' },
];

export default function KeyboardNav() {
  const [showHelp, setShowHelp] = useState(false);
  const navigate = useNavigate();

  const handleKeyDown = useCallback((e) => {
    // Don't capture when typing in inputs
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.contentEditable === 'true') return;

    switch (e.key) {
      case '1': navigate('/gmail'); break;
      case '2': navigate('/ringcentral'); break;
      case '3': navigate('/slack'); break;
      case '4': navigate('/questions'); break;
      case '0': navigate('/'); break;
      case 'e': navigate('/assistant'); break;
      case '/':
        e.preventDefault();
        // Focus the search input in TopBar
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (searchInput) searchInput.focus();
        break;
      case '?':
        e.preventDefault();
        setShowHelp(prev => !prev);
        break;
      case 'Escape':
        setShowHelp(false);
        break;
      default:
        return;
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!showHelp) {
    return (
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-6 left-6 z-40 w-8 h-8 rounded-lg bg-surface-800/80 border border-surface-200/10 flex items-center justify-center text-surface-200/20 hover:text-surface-200/50 hover:border-surface-200/20 transition"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard size={14} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
      <div className="bg-surface-800 border border-surface-200/20 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <Keyboard size={18} className="text-brand-400" />
            Keyboard Shortcuts
          </h3>
          <button onClick={() => setShowHelp(false)} className="text-surface-200/40 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-surface-200/70">{label}</span>
              <kbd className="px-2 py-0.5 bg-surface-900 border border-surface-200/20 rounded text-xs font-mono text-surface-200/60">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
