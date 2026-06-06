import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StickyNote, X, Plus, Trash2, GripVertical } from 'lucide-react';

const STORAGE_KEY = 'corey-parking-lot';

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

export default function ParkingLot() {
  const [notes, setNotes] = useState(loadNotes);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [position, setPosition] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('corey-parking-pos')) || { x: null, y: null };
    } catch { return { x: null, y: null }; }
  });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [justDragged, setJustDragged] = useState(false);
  const [pulse, setPulse] = useState(false);
  const bubbleRef = useRef(null);
  const inputRef = useRef(null);
  const dragStartPos = useRef(null);

  // Save notes on change
  useEffect(() => { saveNotes(notes); }, [notes]);

  // Save position on change
  useEffect(() => {
    if (position.x !== null) {
      localStorage.setItem('corey-parking-pos', JSON.stringify(position));
    }
  }, [position]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Drag handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.parking-panel')) return;
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging(true);
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffset.x));
    const y = Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.y));
    setPosition({ x, y });
  }, [dragging, dragOffset]);

  const handleMouseUp = useCallback((e) => {
    if (!dragging) return;
    setDragging(false);
    // If mouse moved more than 5px, it was a drag not a click
    if (dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx > 5 || dy > 5) {
        setJustDragged(true);
        setTimeout(() => setJustDragged(false), 100);
      }
    }
  }, [dragging]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  function addNote() {
    if (!input.trim()) return;
    const newNote = { id: Date.now(), text: input.trim(), ts: Date.now() };
    setNotes(prev => [newNote, ...prev]);
    setInput('');
    // Pulse effect
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  }

  function deleteNote(id) {
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  function handleBubbleClick() {
    if (justDragged) return;
    setOpen(prev => !prev);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addNote();
    }
  }

  // Default position: bottom-right
  const posStyle = position.x !== null
    ? { left: position.x, top: position.y }
    : { right: 24, bottom: 24 };

  return (
    <div
      ref={bubbleRef}
      className="fixed z-50"
      style={{ ...posStyle, userSelect: dragging ? 'none' : 'auto' }}
    >
      {/* Expanded Panel */}
      {open && (
        <div className="parking-panel absolute bottom-16 right-0 w-80 max-h-96 bg-surface-800 border border-surface-200/20 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-parking-open">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200/10 bg-surface-900/50">
            <div className="flex items-center gap-2">
              <StickyNote size={16} className="text-amber-400" />
              <span className="text-sm font-semibold">Parking Lot</span>
              <span className="text-xs text-surface-200/30">{notes.length}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-surface-200/40 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* Quick Input */}
          <div className="p-3 border-b border-surface-200/10">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Quick thought... (Enter to save)"
                className="flex-1 bg-surface-900/50 border border-surface-200/10 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-200/30 outline-none focus:border-amber-500/50 resize-none"
                rows={2}
              />
              <button
                onClick={addNote}
                disabled={!input.trim()}
                className="self-end px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-30 transition"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto">
            {notes.length === 0 ? (
              <div className="py-8 text-center text-sm text-surface-200/30">
                <StickyNote size={24} className="mx-auto mb-2 opacity-30" />
                Brain dump here — nothing lost
              </div>
            ) : (
              notes.map(note => (
                <div key={note.id} className="group px-4 py-3 border-b border-surface-200/5 hover:bg-surface-200/5 transition">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm text-surface-200/80 whitespace-pre-wrap flex-1">{note.text}</p>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-surface-200/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="text-xs text-surface-200/20 mt-1">{formatTime(note.ts)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating Bubble */}
      <button
        onMouseDown={handleMouseDown}
        onClick={handleBubbleClick}
        className={`w-14 h-14 rounded-full shadow-lg shadow-black/30 flex items-center justify-center transition-all
          ${open ? 'bg-amber-500 text-surface-900' : 'bg-surface-800 border-2 border-amber-500/40 text-amber-400 hover:border-amber-500 hover:bg-surface-700'}
          ${pulse ? 'scale-110' : 'scale-100'}
          ${dragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}
        `}
        title="Parking Lot — dump thoughts here"
      >
        <StickyNote size={22} />
        {notes.length > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full text-[10px] font-bold text-surface-900 flex items-center justify-center">
            {notes.length > 9 ? '9+' : notes.length}
          </span>
        )}
      </button>
    </div>
  );
}
