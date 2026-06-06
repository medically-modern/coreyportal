import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StickyNote, X, Plus, Trash2, Pin, PinOff } from 'lucide-react';
import { api } from '../../services/api';

const LOCAL_KEY = 'corey-parking-lot';

const COLORS = [
  { id: 'gray', bg: 'bg-surface-200/10', border: 'border-surface-200/20', dot: 'bg-surface-200/40', label: 'None' },
  { id: 'red', bg: 'bg-red-500/10', border: 'border-red-500/25', dot: 'bg-red-400', label: 'Urgent' },
  { id: 'amber', bg: 'bg-amber-500/10', border: 'border-amber-500/25', dot: 'bg-amber-400', label: 'Idea' },
  { id: 'green', bg: 'bg-green-500/10', border: 'border-green-500/25', dot: 'bg-green-400', label: 'Done' },
  { id: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/25', dot: 'bg-blue-400', label: 'Follow-up' },
  { id: 'purple', bg: 'bg-purple-500/10', border: 'border-purple-500/25', dot: 'bg-purple-400', label: 'Personal' },
];

function getColor(id) {
  return COLORS.find(c => c.id === id) || COLORS[0];
}

function formatTime(ts) {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

function normalize(n) {
  return {
    id: n.id,
    text: n.text,
    color: n.color || 'gray',
    pinned: n.pinned ? true : false,
    ts: n.created_at ? new Date(n.created_at + (n.created_at.endsWith('Z') ? '' : 'Z')).getTime() : (n.ts || Date.now()),
    updatedAt: n.updated_at ? new Date(n.updated_at + (n.updated_at.endsWith('Z') ? '' : 'Z')).getTime() : null,
    synced: n.synced !== false,
  };
}

export default function ParkingLot() {
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [selectedColor, setSelectedColor] = useState('gray');
  const [position, setPosition] = useState(() => {
    try { return JSON.parse(localStorage.getItem('corey-parking-pos')) || { x: null, y: null }; }
    catch { return { x: null, y: null }; }
  });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [justDragged, setJustDragged] = useState(false);
  const [pulse, setPulse] = useState(false);
  const bubbleRef = useRef(null);
  const inputRef = useRef(null);
  const dragStartPos = useRef(null);

  // Load from server on mount
  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    try {
      const { notes: serverNotes } = await api.notesGet();
      const normalized = serverNotes.map(normalize);
      setNotes(normalized);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(normalized));
      // Push any unsynced local notes
      try {
        const local = JSON.parse(localStorage.getItem(LOCAL_KEY + '-pending') || '[]');
        for (const n of local) {
          await api.notesCreate(n.text, n.color);
        }
        if (local.length > 0) {
          localStorage.removeItem(LOCAL_KEY + '-pending');
          const { notes: fresh } = await api.notesGet();
          setNotes(fresh.map(normalize));
        }
      } catch {}
    } catch {
      try { setNotes(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')); }
      catch { setNotes([]); }
    }
  }

  // Save position
  useEffect(() => {
    if (position.x !== null) localStorage.setItem('corey-parking-pos', JSON.stringify(position));
  }, [position]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
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
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffset.x)),
      y: Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.y)),
    });
  }, [dragging, dragOffset]);

  const handleMouseUp = useCallback((e) => {
    if (!dragging) return;
    setDragging(false);
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

  async function addNote() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    setPulse(true);
    setTimeout(() => setPulse(false), 600);

    const tempNote = { id: `temp-${Date.now()}`, text, color: selectedColor, pinned: false, ts: Date.now(), synced: false };
    setNotes(prev => {
      const pinned = prev.filter(n => n.pinned);
      const unpinned = prev.filter(n => !n.pinned);
      return [...pinned, tempNote, ...unpinned];
    });

    try {
      const { note } = await api.notesCreate(text, selectedColor);
      setNotes(prev => {
        const updated = prev.map(n => n.id === tempNote.id ? normalize(note) : n);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
      try {
        const pending = JSON.parse(localStorage.getItem(LOCAL_KEY + '-pending') || '[]');
        pending.push({ text, color: selectedColor });
        localStorage.setItem(LOCAL_KEY + '-pending', JSON.stringify(pending));
      } catch {}
    }
    setSelectedColor('gray');
  }

  async function updateNote(id, data) {
    // Optimistic update
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, ...data } : n);
      // Re-sort: pinned first
      const pinned = updated.filter(n => n.pinned);
      const unpinned = updated.filter(n => !n.pinned);
      const sorted = [...pinned, ...unpinned];
      localStorage.setItem(LOCAL_KEY, JSON.stringify(sorted));
      return sorted;
    });
    if (typeof id === 'number') {
      try { await api.notesUpdate(id, data); } catch {}
    }
  }

  async function deleteNote(id) {
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      return next;
    });
    if (typeof id === 'number') {
      try { await api.notesDelete(id); } catch {}
    }
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

  const latestNote = notes.length > 0 ? notes[0] : null;

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
        <div className="parking-panel absolute bottom-16 right-0 w-96 max-h-[32rem] bg-surface-800 border border-surface-200/20 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-parking-open">
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

          {/* Quick add */}
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
            {/* Color picker row */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] text-surface-200/30 mr-1">Label:</span>
              {COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedColor(c.id)}
                  className={`w-5 h-5 rounded-full ${c.dot} transition-all ${
                    selectedColor === c.id ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-800 scale-110' : 'opacity-50 hover:opacity-80'
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto">
            {notes.length === 0 ? (
              <div className="py-8 text-center text-sm text-surface-200/30">
                <StickyNote size={24} className="mx-auto mb-2 opacity-30" />
                Brain dump here — nothing lost
              </div>
            ) : (
              notes.map(note => {
                const color = getColor(note.color);
                return (
                  <NoteCard
                    key={note.id}
                    note={note}
                    color={color}
                    onUpdate={(data) => updateNote(note.id, data)}
                    onDelete={() => deleteNote(note.id)}
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Floating Bubble — with latest note preview */}
      <button
        onMouseDown={handleMouseDown}
        onClick={handleBubbleClick}
        className={`group relative flex items-center gap-2 rounded-full shadow-lg shadow-black/30 transition-all
          ${open ? 'bg-amber-500 text-surface-900 px-4 py-3' : 'bg-surface-800 border-2 border-amber-500/40 text-amber-400 hover:border-amber-500 hover:bg-surface-700 px-3 py-3'}
          ${pulse ? 'scale-110' : 'scale-100'}
          ${dragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}
        `}
        title="Parking Lot — dump thoughts here"
      >
        <StickyNote size={20} className="shrink-0" />
        {!open && latestNote && (
          <span className="max-w-[140px] text-xs text-surface-200/60 truncate hidden group-hover:inline">
            {latestNote.text}
          </span>
        )}
        {notes.length > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full text-[10px] font-bold text-surface-900 flex items-center justify-center">
            {notes.length > 9 ? '9+' : notes.length}
          </span>
        )}
      </button>
    </div>
  );
}

// Individual note card with inline edit, color picker, pin
function NoteCard({ note, color, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [showColors, setShowColors] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      autoResize(textareaRef.current);
    }
  }, [editing]);

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function saveEdit() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== note.text) {
      onUpdate({ text: trimmed });
    }
    setEditing(false);
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === 'Escape') {
      setEditText(note.text);
      setEditing(false);
    }
  }

  return (
    <div className={`group px-4 py-3 border-b border-surface-200/5 ${color.bg} transition relative`}>
      {/* Pin indicator */}
      {note.pinned && (
        <div className="absolute top-1.5 right-2 text-amber-400/40">
          <Pin size={10} />
        </div>
      )}

      {/* Note body */}
      {editing ? (
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={e => { setEditText(e.target.value); autoResize(e.target); }}
          onKeyDown={handleEditKeyDown}
          onBlur={saveEdit}
          className="w-full bg-surface-900/50 border border-surface-200/20 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-amber-500/50 resize-none"
          rows={1}
        />
      ) : (
        <p
          className="text-sm text-surface-200/80 whitespace-pre-wrap cursor-pointer hover:text-white transition"
          onClick={() => { setEditing(true); setEditText(note.text); }}
        >
          {note.text}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-surface-200/20">{formatTime(note.ts)}</span>
          {!note.synced && <span className="text-[9px] text-amber-500/50">saving...</span>}
          {/* Color dot — click to change */}
          <button
            onClick={() => setShowColors(!showColors)}
            className={`w-3 h-3 rounded-full ${color.dot} opacity-60 hover:opacity-100 transition`}
            title="Change label"
          />
        </div>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={() => onUpdate({ pinned: !note.pinned })}
            className={`p-1 rounded hover:bg-surface-200/10 transition ${note.pinned ? 'text-amber-400' : 'text-surface-200/30 hover:text-amber-400'}`}
            title={note.pinned ? 'Unpin' : 'Pin to top'}
          >
            {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-surface-200/20 hover:text-red-400 hover:bg-surface-200/10 transition"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Color picker dropdown */}
      {showColors && (
        <div className="flex items-center gap-1.5 mt-2 py-1">
          {COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => { onUpdate({ color: c.id }); setShowColors(false); }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] transition ${c.bg} ${c.border} border ${
                note.color === c.id ? 'ring-1 ring-white/30' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
