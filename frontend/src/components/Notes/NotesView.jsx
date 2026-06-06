import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Plus, Trash2, Pin, PinOff, Search, Filter, X, Check, Loader } from 'lucide-react';
import { api } from '../../services/api';

const COLORS = [
  { id: 'gray', bg: 'bg-surface-200/10', border: 'border-surface-200/20', dot: 'bg-surface-200/40', label: 'None', ring: 'ring-surface-200/30' },
  { id: 'red', bg: 'bg-red-500/10', border: 'border-red-500/25', dot: 'bg-red-400', label: 'Urgent', ring: 'ring-red-400/50' },
  { id: 'amber', bg: 'bg-amber-500/10', border: 'border-amber-500/25', dot: 'bg-amber-400', label: 'Idea', ring: 'ring-amber-400/50' },
  { id: 'green', bg: 'bg-green-500/10', border: 'border-green-500/25', dot: 'bg-green-400', label: 'Done', ring: 'ring-green-400/50' },
  { id: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/25', dot: 'bg-blue-400', label: 'Follow-up', ring: 'ring-blue-400/50' },
  { id: 'purple', bg: 'bg-purple-500/10', border: 'border-purple-500/25', dot: 'bg-purple-400', label: 'Personal', ring: 'ring-purple-400/50' },
];

function getColor(id) {
  return COLORS.find(c => c.id === id) || COLORS[0];
}

function formatTime(ts) {
  if (!ts) return '';
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
  };
}

export default function NotesView() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [selectedColor, setSelectedColor] = useState('gray');
  const [search, setSearch] = useState('');
  const [filterColor, setFilterColor] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { loadNotes(); }, []);

  async function loadNotes() {
    try {
      const { notes: serverNotes } = await api.notesGet();
      setNotes(serverNotes.map(normalize));
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  async function addNote() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    const tempId = `temp-${Date.now()}`;
    const temp = { id: tempId, text, color: selectedColor, pinned: false, ts: Date.now() };
    setNotes(prev => {
      const pinned = prev.filter(n => n.pinned);
      const unpinned = prev.filter(n => !n.pinned);
      return [...pinned, temp, ...unpinned];
    });
    try {
      const { note } = await api.notesCreate(text, selectedColor);
      setNotes(prev => prev.map(n => n.id === tempId ? normalize(note) : n));
    } catch {}
    setSelectedColor('gray');
    inputRef.current?.focus();
  }

  async function updateNote(id, data) {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, ...data } : n);
      const pinned = updated.filter(n => n.pinned);
      const unpinned = updated.filter(n => !n.pinned);
      return [...pinned, ...unpinned];
    });
    if (typeof id === 'number') {
      try { await api.notesUpdate(id, data); } catch {}
    }
  }

  async function deleteNote(id) {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (typeof id === 'number') {
      try { await api.notesDelete(id); } catch {}
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addNote();
    }
  }

  // Filter and search
  const filtered = notes.filter(n => {
    if (filterColor && n.color !== filterColor) return false;
    if (search && !n.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pinnedNotes = filtered.filter(n => n.pinned);
  const unpinnedNotes = filtered.filter(n => !n.pinned);

  // Count by color for filter badges
  const colorCounts = {};
  for (const n of notes) {
    colorCounts[n.color] = (colorCounts[n.color] || 0) + 1;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <StickyNote size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Parking Lot</h1>
            <p className="text-xs text-surface-200/40">{notes.length} note{notes.length !== 1 ? 's' : ''} — brain dump, nothing lost</p>
          </div>
        </div>
      </div>

      {/* New note input — big and prominent */}
      <div className="rounded-2xl bg-surface-800 border border-surface-200/15 p-4 mb-6">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind? (Enter to save, Shift+Enter for new line)"
          className="w-full bg-transparent text-white placeholder-surface-200/30 outline-none resize-none text-base leading-relaxed"
          rows={3}
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-200/10">
          {/* Color picker */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-surface-200/30 uppercase tracking-wider">Label:</span>
            {COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedColor(c.id)}
                className={`w-6 h-6 rounded-full ${c.dot} transition-all ${
                  selectedColor === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-800 scale-110' : 'opacity-40 hover:opacity-70'
                }`}
                title={c.label}
              />
            ))}
          </div>
          <button
            onClick={addNote}
            disabled={!input.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 disabled:opacity-30 transition font-medium text-sm"
          >
            <Plus size={16} /> Add Note
          </button>
        </div>
      </div>

      {/* Search & filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-200/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full bg-surface-800 border border-surface-200/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-surface-200/30 outline-none focus:border-amber-500/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200/30 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition ${
            filterColor ? 'bg-amber-500/20 text-amber-400' : 'bg-surface-800 text-surface-200/50 hover:text-white'
          }`}
        >
          <Filter size={14} />
          {filterColor ? getColor(filterColor).label : 'Filter'}
        </button>
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-surface-800/50">
          <button
            onClick={() => setFilterColor(null)}
            className={`px-3 py-1.5 rounded-full text-xs transition ${
              !filterColor ? 'bg-surface-200/15 text-white' : 'text-surface-200/40 hover:text-white'
            }`}
          >
            All ({notes.length})
          </button>
          {COLORS.map(c => {
            const count = colorCounts[c.id] || 0;
            if (count === 0) return null;
            return (
              <button
                key={c.id}
                onClick={() => setFilterColor(filterColor === c.id ? null : c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition ${c.bg} ${c.border} border ${
                  filterColor === c.id ? 'ring-1 ring-white/30' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                {c.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <StickyNote size={40} className="mx-auto mb-3 text-surface-200/15" />
          <p className="text-surface-200/30">{search || filterColor ? 'No notes match your filter' : 'No notes yet — start dumping thoughts above'}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Pinned section */}
          {pinnedNotes.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest px-1 mb-2 flex items-center gap-1.5">
                <Pin size={10} /> Pinned
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {pinnedNotes.map(note => (
                  <FullNoteCard
                    key={note.id}
                    note={note}
                    onUpdate={(data) => updateNote(note.id, data)}
                    onDelete={() => deleteNote(note.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* All other notes */}
          {unpinnedNotes.length > 0 && (
            <>
              {pinnedNotes.length > 0 && (
                <p className="text-[10px] font-bold text-surface-200/30 uppercase tracking-widest px-1 mb-2">All Notes</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unpinnedNotes.map(note => (
                  <FullNoteCard
                    key={note.id}
                    note={note}
                    onUpdate={(data) => updateNote(note.id, data)}
                    onDelete={() => deleteNote(note.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Full-size note card for the page view
function FullNoteCard({ note, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [showColors, setShowColors] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef(null);
  const color = getColor(note.color);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      autoResize(textareaRef.current);
    }
  }, [editing]);

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.max(60, el.scrollHeight) + 'px';
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

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onDelete();
  }

  return (
    <div className={`group rounded-xl ${color.bg} border ${color.border} p-4 transition hover:border-opacity-50 relative`}>
      {/* Pin badge */}
      {note.pinned && (
        <div className="absolute top-2 right-2">
          <Pin size={12} className="text-amber-400/50" />
        </div>
      )}

      {/* Note body — auto-sized */}
      {editing ? (
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={e => { setEditText(e.target.value); autoResize(e.target); }}
          onKeyDown={handleEditKeyDown}
          onBlur={saveEdit}
          className="w-full bg-surface-900/50 border border-surface-200/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50 resize-none leading-relaxed"
          rows={2}
        />
      ) : (
        <p
          className="text-sm text-surface-200/80 whitespace-pre-wrap leading-relaxed cursor-pointer hover:text-white transition min-h-[1.5rem]"
          onClick={() => { setEditing(true); setEditText(note.text); }}
        >
          {note.text}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-200/5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-surface-200/25">{formatTime(note.ts)}</span>
          {note.updatedAt && note.updatedAt !== note.ts && (
            <span className="text-[10px] text-surface-200/20">· edited</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          {/* Color picker toggle */}
          <button
            onClick={() => setShowColors(!showColors)}
            className={`w-4 h-4 rounded-full ${color.dot} opacity-50 hover:opacity-100 transition`}
            title="Change label"
          />
          <button
            onClick={() => onUpdate({ pinned: !note.pinned })}
            className={`p-1.5 rounded-lg transition ${note.pinned ? 'text-amber-400 hover:bg-amber-500/10' : 'text-surface-200/30 hover:text-amber-400 hover:bg-amber-500/10'}`}
            title={note.pinned ? 'Unpin' : 'Pin to top'}
          >
            {note.pinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
          <button
            onClick={handleDelete}
            className={`p-1.5 rounded-lg transition ${
              confirmDelete ? 'text-red-400 bg-red-500/10' : 'text-surface-200/30 hover:text-red-400 hover:bg-red-500/10'
            }`}
            title={confirmDelete ? 'Click again to confirm' : 'Delete'}
          >
            {confirmDelete ? <Check size={13} /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      {/* Color picker */}
      {showColors && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-surface-200/5">
          {COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => { onUpdate({ color: c.id }); setShowColors(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] transition ${c.bg} ${c.border} border ${
                note.color === c.id ? 'ring-1 ring-white/30' : 'opacity-50 hover:opacity-100'
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
