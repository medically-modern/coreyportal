import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronRight,
  CheckCircle2, Clock, Zap, AlertTriangle, MoreHorizontal,
  X, FolderKanban, Sparkles, Edit3, Calendar, Target,
  Moon, Sun, Battery, BatteryLow, BatteryFull, Timer,
  SkipForward, Wand2, ListChecks, Eye, EyeOff, Flame, Pencil,
  User, Users, UserPlus, Columns3
} from 'lucide-react';
import { api } from '../../services/api';

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

const PRIORITY_META = {
  low:    { icon: Clock,         color: 'text-surface-200/40', bg: 'bg-surface-200/5', label: 'Low' },
  normal: { icon: ChevronRight,  color: 'text-blue-400',       bg: 'bg-blue-500/10',   label: 'Normal' },
  high:   { icon: AlertTriangle, color: 'text-amber-400',      bg: 'bg-amber-500/10',  label: 'High' },
  urgent: { icon: Zap,           color: 'text-red-400',        bg: 'bg-red-500/10',    label: 'Urgent' },
};

const ENERGY_META = {
  low:    { icon: BatteryLow,  label: 'Low brain',  color: 'text-cyan-400',  bg: 'bg-cyan-500/10' },
  normal: { icon: Battery,     label: 'Normal',     color: 'text-surface-200/40', bg: 'bg-surface-200/5' },
  high:   { icon: BatteryFull, label: 'Deep focus', color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

const WIP_LIMIT = 3;
const STALE_DAYS = 14;

// ─── Helpers ─────────────────────────────────────────────
function parseSubtasks(task) {
  try {
    const s = JSON.parse(task.subtasks || '[]');
    return Array.isArray(s) ? s : [];
  } catch { return []; }
}

function isSnoozed(task) {
  return task.snoozed_until && new Date(task.snoozed_until) > new Date();
}

function isOverdue(task) {
  return task.due_date && new Date(task.due_date) < new Date() && !task.completed;
}

function isStale(task) {
  if (task.completed) return false;
  const ref = task.updated_at || task.created_at;
  if (!ref) return false;
  return (Date.now() - new Date(ref.replace(' ', 'T') + 'Z').getTime()) > STALE_DAYS * 86400000;
}

function dueLabel(task) {
  if (!task.due_date) return null;
  const due = new Date(task.due_date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return due.toLocaleDateString('en-US', { weekday: 'short' });
  return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initialsOf(name) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function colorFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
}

// Rank tasks for "What now?" — overdue first, then urgency, then due date, then oldest
function rankTasks(tasks, columns) {
  const doneColIds = columns.filter(c => /done|complete/i.test(c.name)).map(c => c.id);
  const priWeight = { urgent: 100, high: 50, normal: 10, low: 0 };
  return tasks
    .filter(t => !t.completed && !isSnoozed(t) && !doneColIds.includes(t.column_id))
    .map(t => {
      let score = priWeight[t.priority] ?? 10;
      if (isOverdue(t)) score += 1000;
      if (t.due_date) {
        const days = (new Date(t.due_date) - Date.now()) / 86400000;
        if (days >= 0 && days <= 2) score += 200;
      }
      score += Math.min(30, (Date.now() - new Date((t.created_at || '').replace(' ', 'T') + 'Z').getTime()) / 86400000);
      return { task: t, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.task);
}

// ─── Avatar ──────────────────────────────────────────────
function Avatar({ name, size = 18 }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: colorFor(name), fontSize: size * 0.42 }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}

// ─── Assignee picker popover ─────────────────────────────
function AssigneePicker({ team, current, onPick, onClose }) {
  const [value, setValue] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  function pick(name) { onPick(name); onClose(); }

  return (
    <div ref={ref} className="absolute left-0 top-6 bg-surface-800 border border-surface-200/20 rounded-lg shadow-xl shadow-black/40 py-1.5 z-30 w-48 animate-slide-up">
      <form
        onSubmit={e => { e.preventDefault(); if (value.trim()) pick(value.trim()); }}
        className="px-2 pb-1.5"
      >
        <input
          autoFocus value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Type a name..."
          className="w-full bg-surface-900/60 border border-surface-200/10 rounded-md px-2 py-1 text-xs text-white placeholder-surface-200/25 outline-none focus:border-brand-500/40"
        />
      </form>
      {team.filter(n => !value || n.toLowerCase().includes(value.toLowerCase())).map(n => (
        <button key={n} onClick={() => pick(n)}
          className="w-full text-left px-2.5 py-1.5 text-xs text-surface-200/70 hover:bg-surface-200/10 flex items-center gap-2">
          <Avatar name={n} size={16} /> {n}
        </button>
      ))}
      {current && (
        <button onClick={() => pick(null)}
          className="w-full text-left px-2.5 py-1.5 text-xs text-surface-200/40 hover:bg-surface-200/10 flex items-center gap-2 border-t border-surface-200/10 mt-1">
          <X size={12} /> Unassign
        </button>
      )}
    </div>
  );
}

// ─── Confetti ────────────────────────────────────────────
function ConfettiBurst({ onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 1400);
    return () => clearTimeout(t);
  }, [onDone]);
  const pieces = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    left: 35 + Math.random() * 30,
    delay: Math.random() * 0.2,
    dur: 0.9 + Math.random() * 0.5,
    color: PROJECT_COLORS[i % PROJECT_COLORS.length],
    dx: (Math.random() - 0.5) * 360,
    rot: Math.random() * 720 - 360,
    size: 5 + Math.random() * 6,
  })), []);
  return (
    <div className="fixed inset-0 pointer-events-none z-[90] overflow-hidden">
      <style>{`@keyframes confetti-fall {
        0% { transform: translate(0,-10vh) rotate(0deg); opacity: 1; }
        100% { transform: translate(var(--dx), 70vh) rotate(var(--rot)); opacity: 0; }
      }`}</style>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', top: '15%', left: `${p.left}%`,
          width: p.size, height: p.size, backgroundColor: p.color, borderRadius: 2,
          '--dx': `${p.dx}px`, '--rot': `${p.rot}deg`,
          animation: `confetti-fall ${p.dur}s ease-in ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

// ─── Subtask checklist ───────────────────────────────────
function SubtaskList({ task, onUpdate, big = false }) {
  const subs = parseSubtasks(task);
  const [newSub, setNewSub] = useState('');

  function setSubs(next) {
    onUpdate(task.id, { subtasks: JSON.stringify(next) });
  }
  function toggle(i) {
    setSubs(subs.map((s, idx) => idx === i ? { ...s, done: !s.done } : s));
  }
  function remove(i) {
    setSubs(subs.filter((_, idx) => idx !== i));
  }
  function add(e) {
    e.preventDefault();
    if (!newSub.trim()) return;
    setSubs([...subs, { text: newSub.trim(), done: false }]);
    setNewSub('');
  }

  return (
    <div className={big ? 'space-y-2' : 'space-y-1 mt-2'}>
      {subs.map((s, i) => (
        <div key={i} className={`group/sub flex items-start gap-2 ${big ? 'text-base' : 'text-xs'}`}>
          <button onClick={() => toggle(i)} className="shrink-0 mt-0.5">
            <CheckCircle2 size={big ? 20 : 13} className={s.done ? 'text-good' : 'text-surface-200/25 hover:text-good/60'} />
          </button>
          <span className={`flex-1 ${s.done ? 'line-through text-surface-200/30' : big ? 'text-white' : 'text-surface-200/70'}`}>
            {s.text}
          </span>
          <button onClick={() => remove(i)} className="opacity-0 group-hover/sub:opacity-100 text-surface-200/20 hover:text-red-400 shrink-0">
            <X size={big ? 14 : 11} />
          </button>
        </div>
      ))}
      <form onSubmit={add} className="flex gap-1.5">
        <input
          value={newSub}
          onChange={e => setNewSub(e.target.value)}
          placeholder="+ tiny step"
          className={`flex-1 bg-transparent border-b border-surface-200/10 focus:border-brand-500/40 outline-none text-surface-200/60 placeholder-surface-200/20 ${big ? 'text-sm py-1' : 'text-[11px] py-0.5'}`}
        />
      </form>
    </div>
  );
}

// ─── Focus Mode overlay ──────────────────────────────────
const TIMER_PRESETS = [5, 15, 25];

function FocusOverlay({ queue, queueIndex, onNext, onClose, onUpdate, onComplete, onSnooze, projectId }) {
  const task = queue[queueIndex];
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [totalSeconds, setTotalSeconds] = useState(null);
  const [timeUp, setTimeUp] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    setSecondsLeft(null); setTotalSeconds(null); setTimeUp(false);
    clearInterval(intervalRef.current);
  }, [task?.id]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function startTimer(min) {
    clearInterval(intervalRef.current);
    setTimeUp(false);
    setTotalSeconds(min * 60);
    setSecondsLeft(min * 60);
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(intervalRef.current); setTimeUp(true); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function breakDown() {
    setBreaking(true);
    try {
      const { task: updated } = await api.projectTaskBreakdown(projectId, task.id);
      onUpdate(task.id, { subtasks: updated.subtasks }, { skipServer: true });
    } catch (e) {
      console.error('Breakdown failed:', e);
    } finally {
      setBreaking(false);
    }
  }

  if (!task) {
    return (
      <div className="fixed inset-0 bg-surface-900/95 backdrop-blur z-[80] flex flex-col items-center justify-center p-6">
        <Sparkles size={48} className="text-good mb-4" />
        <h2 className="text-2xl font-bold mb-2">Queue clear 🎉</h2>
        <p className="text-surface-200/50 mb-6">Nothing urgent left. Go take a break — you earned it.</p>
        <button onClick={onClose} className="btn-primary rounded-xl px-6 py-2.5">Back to board</button>
      </div>
    );
  }

  const pri = PRIORITY_META[task.priority] || PRIORITY_META.normal;
  const subs = parseSubtasks(task);
  const doneSubs = subs.filter(s => s.done).length;
  const pct = totalSeconds ? (secondsLeft / totalSeconds) : 0;
  const mm = Math.floor((secondsLeft || 0) / 60);
  const ss = String((secondsLeft || 0) % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 bg-surface-900/97 backdrop-blur z-[80] flex flex-col items-center justify-start overflow-y-auto py-10 px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-surface-200/40 text-sm">
            <Target size={16} className="text-brand-400" />
            One thing at a time · {queueIndex + 1} of {queue.length}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-200/10 text-surface-200/50 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <div className={`rounded-3xl border p-8 mb-6 ${timeUp ? 'border-amber-500/50 bg-amber-500/5' : 'border-surface-200/15 bg-surface-800/60'}`}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${pri.bg} ${pri.color}`}>
              <pri.icon size={11} /> {pri.label}
            </span>
            {task.assignee && (
              <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded bg-surface-200/5 text-surface-200/60">
                <Avatar name={task.assignee} size={14} /> {task.assignee}
              </span>
            )}
            {task.due_date && (
              <span className={`text-xs px-2 py-0.5 rounded ${isOverdue(task) ? 'bg-red-500/20 text-red-400' : 'bg-surface-200/5 text-surface-200/40'}`}>
                <Calendar size={10} className="inline mr-1" />{dueLabel(task)}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight mb-4">{task.title}</h1>
          {task.description && <p className="text-surface-200/50 text-sm mb-4 whitespace-pre-wrap">{task.description}</p>}

          {subs.length > 0 && (
            <div className="mb-2 text-xs text-surface-200/40">{doneSubs}/{subs.length} steps</div>
          )}
          <SubtaskList task={task} onUpdate={onUpdate} big />

          {subs.length === 0 && (
            <button
              onClick={breakDown}
              disabled={breaking}
              className="mt-4 flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 disabled:opacity-50 transition"
            >
              {breaking ? <Sparkles size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {breaking ? 'Elena is breaking it down...' : 'Feels too big? Break it into tiny steps'}
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 mb-8">
          {secondsLeft === null ? (
            <div className="flex items-center gap-3">
              <Timer size={18} className="text-surface-200/40" />
              <span className="text-sm text-surface-200/40">Start a sprint:</span>
              {TIMER_PRESETS.map(m => (
                <button
                  key={m}
                  onClick={() => startTimer(m)}
                  className="px-4 py-2 rounded-xl bg-surface-200/10 hover:bg-brand-600/30 text-white text-sm font-medium transition"
                >
                  {m} min
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-200/10" />
                  <circle
                    cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct)}`}
                    strokeLinecap="round"
                    className={timeUp ? 'text-amber-400' : 'text-brand-400 transition-all duration-1000'}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums">
                  {mm}:{ss}
                </span>
              </div>
              {timeUp ? (
                <div className="text-amber-400 text-sm font-medium">Time's up! Done, or going again?</div>
              ) : (
                <button
                  onClick={() => { clearInterval(intervalRef.current); setSecondsLeft(null); setTotalSeconds(null); }}
                  className="text-xs text-surface-200/40 hover:text-surface-200/70"
                >
                  cancel timer
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => onComplete(task.id)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-good/20 text-good hover:bg-good/30 font-semibold transition text-lg"
          >
            <CheckCircle2 size={22} /> Done!
          </button>
          <button
            onClick={() => onNext()}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-surface-200/10 text-surface-200/60 hover:bg-surface-200/15 hover:text-white transition"
          >
            <SkipForward size={18} /> Not now — next
          </button>
          <button
            onClick={() => { onSnooze(task.id, 1); onNext(); }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-surface-200/10 text-surface-200/60 hover:bg-surface-200/15 hover:text-white transition"
          >
            <Moon size={18} /> Snooze 'til tomorrow
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add To Do bar ───────────────────────────────────────
function AddToDo({ onAdd }) {
  const [value, setValue] = useState('');
  const [flash, setFlash] = useState(false);
  const inputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue('');
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
        flash ? 'border-good/60 bg-good/5' : 'border-brand-500/30 bg-surface-800/80 focus-within:border-brand-500/60 focus-within:shadow-lg focus-within:shadow-brand-600/10'
      }`}>
        <Plus size={18} className={flash ? 'text-good' : 'text-brand-400'} />
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Add a to do — type it, hit Enter, it's on the board..."
          className="flex-1 bg-transparent text-white placeholder-surface-200/30 outline-none text-sm"
        />
        {flash ? (
          <span className="text-xs text-good font-medium animate-slide-up">Added ✓</span>
        ) : value.trim() ? (
          <kbd className="text-[10px] text-surface-200/30 border border-surface-200/15 rounded px-1.5 py-0.5">↵</kbd>
        ) : null}
      </div>
    </form>
  );
}

// ─── Task Card ───────────────────────────────────────────
function TaskCard({ task, onUpdate, onDelete, onFocus, onSnooze, isCompany, team, statusLabel }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [showSubs, setShowSubs] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [desc, setDesc] = useState(task.description || '');
  const pri = PRIORITY_META[task.priority] || PRIORITY_META.normal;
  const energy = ENERGY_META[task.energy] || ENERGY_META.normal;
  const PriIcon = pri.icon;
  const EnergyIcon = energy.icon;
  const subs = parseSubtasks(task);
  const doneSubs = subs.filter(s => s.done).length;
  const overdue = isOverdue(task);
  const stale = isStale(task);
  const snoozed = isSnoozed(task);

  function saveTitle() {
    if (title.trim() && title !== task.title) onUpdate(task.id, { title: title.trim() });
    setEditing(false);
  }
  function saveDesc() {
    if (desc !== task.description) onUpdate(task.id, { description: desc });
    setShowDesc(false);
  }
  function cyclePriority() {
    const order = ['low', 'normal', 'high', 'urgent'];
    onUpdate(task.id, { priority: order[(order.indexOf(task.priority) + 1) % order.length] });
  }
  function cycleEnergy() {
    const order = ['low', 'normal', 'high'];
    onUpdate(task.id, { energy: order[(order.indexOf(task.energy || 'normal') + 1) % order.length] });
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', String(task.id));
        e.dataTransfer.setData('fromColumn', String(task.column_id));
        e.dataTransfer.setData('fromAssignee', task.assignee || '');
      }}
      className={`group relative bg-surface-800 border rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all hover:border-surface-200/30 ${
        task.completed ? 'opacity-40 border-surface-200/5'
        : snoozed ? 'opacity-50 border-surface-200/10 border-dashed'
        : overdue ? 'border-red-500/40'
        : stale ? 'border-amber-500/20'
        : 'border-surface-200/10'
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-surface-200/20 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition" />

        <button onClick={() => onUpdate(task.id, { completed: !task.completed }, { celebrate: !task.completed })} className="mt-0.5 shrink-0">
          <CheckCircle2 size={16} className={task.completed ? 'text-good' : 'text-surface-200/20 hover:text-good/60'} />
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(task.title); setEditing(false); } }}
              className="w-full bg-transparent text-sm text-white outline-none border-b border-brand-500/50"
            />
          ) : (
            <p onClick={() => setEditing(true)}
               className={`text-sm leading-snug cursor-text ${task.completed ? 'line-through text-surface-200/40' : 'text-white'}`}>
              {task.title}
            </p>
          )}

          {subs.length > 0 && (
            <button onClick={() => setShowSubs(!showSubs)} className="w-full mt-1.5 group/prog">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-surface-200/10 rounded-full overflow-hidden">
                  <div className="h-full bg-good/60 rounded-full transition-all duration-300" style={{ width: `${(doneSubs / subs.length) * 100}%` }} />
                </div>
                <span className="text-[10px] text-surface-200/40 tabular-nums">{doneSubs}/{subs.length}</span>
              </div>
            </button>
          )}
          {showSubs && <SubtaskList task={task} onUpdate={onUpdate} />}

          {/* Chips */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {/* Who — company boards lead with the person */}
            {isCompany && (
              <div className="relative">
                <button
                  onClick={() => setShowAssign(!showAssign)}
                  title={task.assignee ? `Assigned to ${task.assignee} — click to change` : 'Assign to someone'}
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition hover:opacity-80 ${
                    task.assignee ? 'bg-surface-200/10 text-white font-medium' : 'bg-surface-200/5 text-surface-200/30 border border-dashed border-surface-200/15'
                  }`}
                >
                  {task.assignee ? (<><Avatar name={task.assignee} size={13} /> {task.assignee}</>) : (<><UserPlus size={10} /> assign</>)}
                </button>
                {showAssign && (
                  <AssigneePicker
                    team={team || []}
                    current={task.assignee}
                    onPick={(name) => onUpdate(task.id, { assignee: name })}
                    onClose={() => setShowAssign(false)}
                  />
                )}
              </div>
            )}

            {/* When — company boards always show a due slot */}
            {task.due_date ? (
              <button
                onClick={() => {
                  const date = prompt('Due date (YYYY-MM-DD), or blank to clear:', task.due_date?.slice(0, 10) || '');
                  if (date !== null) onUpdate(task.id, { due_date: date || null });
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded transition hover:opacity-80 ${overdue ? 'bg-red-500/20 text-red-400 font-semibold' : isCompany ? 'bg-blue-500/10 text-blue-300' : 'bg-surface-200/5 text-surface-200/40'}`}
              >
                <Calendar size={8} className="inline mr-0.5" />{dueLabel(task)}
              </button>
            ) : isCompany && !task.completed ? (
              <button
                onClick={() => {
                  const date = prompt('Due date (YYYY-MM-DD):');
                  if (date) onUpdate(task.id, { due_date: date });
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-surface-200/5 text-surface-200/30 border border-dashed border-surface-200/15 hover:text-surface-200/60 transition"
              >
                <Calendar size={8} className="inline mr-0.5" />+ due
              </button>
            ) : null}

            {/* Status badge (people view) */}
            {statusLabel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-200/5 text-surface-200/40">{statusLabel}</span>
            )}

            <button onClick={cyclePriority} title="Click to change priority"
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${pri.bg} ${pri.color} hover:opacity-80 transition`}>
              <PriIcon size={10} /> {pri.label}
            </button>

            {!isCompany && (
              <button onClick={cycleEnergy} title="What kind of brain does this need?"
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${energy.bg} ${energy.color} hover:opacity-80 transition`}>
                <EnergyIcon size={10} /> {energy.label}
              </button>
            )}

            {snoozed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-200/5 text-surface-200/40">
                <Moon size={8} className="inline mr-0.5" />snoozed
              </span>
            )}
            {stale && !snoozed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/70" title={`Untouched for ${STALE_DAYS}+ days — still relevant?`}>
                💤 stale
              </span>
            )}
            {task.description && !showDesc && (
              <button onClick={() => setShowDesc(true)} className="text-[10px] text-surface-200/25 hover:text-surface-200/50">
                <Edit3 size={10} className="inline" /> note
              </button>
            )}
          </div>

          {showDesc && (
            <textarea
              autoFocus value={desc}
              onChange={e => setDesc(e.target.value)}
              onBlur={saveDesc}
              placeholder="Add a note..."
              className="w-full mt-2 bg-surface-900/50 border border-surface-200/10 rounded-lg px-2 py-1.5 text-xs text-surface-200/70 placeholder-surface-200/20 outline-none focus:border-brand-500/30 resize-none"
              rows={2}
            />
          )}
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0">
          {!task.completed && (
            <button onClick={() => onFocus(task.id)} title="Focus on this"
              className="text-surface-200/20 hover:text-brand-400 opacity-0 group-hover:opacity-100 transition">
              <Target size={14} />
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)}
              className="text-surface-200/20 hover:text-surface-200/60 opacity-0 group-hover:opacity-100 transition">
              <MoreHorizontal size={14} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-6 bg-surface-800 border border-surface-200/20 rounded-lg shadow-xl shadow-black/40 py-1 z-20 w-44 animate-slide-up">
                <button onClick={() => { setShowSubs(true); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-surface-200/60 hover:bg-surface-200/10 flex items-center gap-2">
                  <ListChecks size={12} /> Steps / checklist
                </button>
                <button onClick={() => { setShowDesc(true); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-surface-200/60 hover:bg-surface-200/10 flex items-center gap-2">
                  <Edit3 size={12} /> Add note
                </button>
                {isCompany && (
                  <button onClick={() => { setShowAssign(true); setShowMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-surface-200/60 hover:bg-surface-200/10 flex items-center gap-2">
                    <User size={12} /> Assign to...
                  </button>
                )}
                <button
                  onClick={() => {
                    const date = prompt('Due date (YYYY-MM-DD):');
                    if (date) onUpdate(task.id, { due_date: date });
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-surface-200/60 hover:bg-surface-200/10 flex items-center gap-2">
                  <Calendar size={12} /> Set due date
                </button>
                {!snoozed ? (
                  <>
                    <button onClick={() => { onSnooze(task.id, 1); setShowMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-surface-200/60 hover:bg-surface-200/10 flex items-center gap-2">
                      <Moon size={12} /> Snooze 'til tomorrow
                    </button>
                    <button onClick={() => { onSnooze(task.id, 7); setShowMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-surface-200/60 hover:bg-surface-200/10 flex items-center gap-2">
                      <Moon size={12} /> Snooze a week
                    </button>
                  </>
                ) : (
                  <button onClick={() => { onUpdate(task.id, { snoozed_until: null }); setShowMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-surface-200/60 hover:bg-surface-200/10 flex items-center gap-2">
                    <Sun size={12} /> Wake up
                  </button>
                )}
                <button onClick={() => { onDelete(task.id); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400/70 hover:bg-red-500/10 flex items-center gap-2">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Add (per column) ──────────────────────────────
function QuickAdd({ onAdd, placeholder }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue('');
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        ref={inputRef} value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-surface-900/50 border border-surface-200/10 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-200/30 outline-none focus:border-brand-500/50 transition"
      />
      <button type="submit" disabled={!value.trim()}
        className="px-3 py-2 bg-brand-600/20 text-brand-400 rounded-lg hover:bg-brand-600/30 disabled:opacity-30 transition">
        <Plus size={16} />
      </button>
    </form>
  );
}

// ─── Kanban Column (status view) ─────────────────────────
function KanbanColumn({ column, tasks, hiddenCount, onAddTask, onUpdateTask, onDeleteTask, onMoveTask, onFocusTask, onSnoozeTask, isCompany, team }) {
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    const fromColumn = e.dataTransfer.getData('fromColumn');
    if (taskId && String(fromColumn) !== String(column.id)) {
      onMoveTask(Number(taskId), column.id);
    }
  }

  const isProgress = /progress|doing|active/i.test(column.name);
  const isWaiting = /waiting|blocked/i.test(column.name);
  const activeCount = tasks.filter(t => !t.completed).length;
  const overWip = isProgress && activeCount > WIP_LIMIT;

  return (
    <div
      className={`flex-1 min-w-[260px] max-w-[340px] flex flex-col rounded-2xl transition-all ${
        dragOver ? 'bg-brand-600/10 ring-2 ring-brand-500/30' : 'bg-surface-900/30'
      }`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {isWaiting && <Clock size={13} className="text-amber-400/60" />}
          <h3 className="text-sm font-semibold text-surface-200/70">{column.name}</h3>
          <span className="text-[10px] text-surface-200/30 bg-surface-200/5 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
          {hiddenCount > 0 && (
            <span className="text-[10px] text-surface-200/25" title="snoozed or filtered out">+{hiddenCount} hidden</span>
          )}
        </div>
      </div>

      {overWip && (
        <div className="mx-3 mb-2 flex items-center gap-2 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
          <AlertTriangle size={12} className="shrink-0" />
          {activeCount} things in flight — pick ONE to finish first
        </div>
      )}

      <div className="px-3 pb-3 space-y-2">
        {tasks.map(task => (
          <TaskCard
            key={task.id} task={task}
            onUpdate={onUpdateTask} onDelete={onDeleteTask}
            onFocus={onFocusTask} onSnooze={onSnoozeTask}
            isCompany={isCompany} team={team}
          />
        ))}
        <QuickAdd placeholder={`+ Add to ${column.name}...`} onAdd={(title) => onAddTask(title, column.id)} />
      </div>
    </div>
  );
}

// ─── Person Column (people view — company boards) ────────
function PersonColumn({ person, tasks, columns, onUpdateTask, onDeleteTask, onFocusTask, onSnoozeTask, team }) {
  const [dragOver, setDragOver] = useState(false);
  const colName = (id) => columns.find(c => c.id === id)?.name || '';

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;
    onUpdateTask(Number(taskId), { assignee: person === '__unassigned__' ? null : person });
  }

  const openCount = tasks.filter(t => !t.completed).length;
  const overdueCount = tasks.filter(isOverdue).length;

  return (
    <div
      className={`flex-1 min-w-[260px] max-w-[340px] flex flex-col rounded-2xl transition-all ${
        dragOver ? 'bg-brand-600/10 ring-2 ring-brand-500/30' : 'bg-surface-900/30'
      }`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {person === '__unassigned__' ? (
            <>
              <User size={14} className="text-surface-200/30" />
              <h3 className="text-sm font-semibold text-surface-200/50">Unassigned</h3>
            </>
          ) : (
            <>
              <Avatar name={person} size={20} />
              <h3 className="text-sm font-semibold text-surface-200/80">{person}</h3>
            </>
          )}
          <span className="text-[10px] text-surface-200/30 bg-surface-200/5 px-1.5 py-0.5 rounded-full">{openCount}</span>
          {overdueCount > 0 && (
            <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">{overdueCount} overdue</span>
          )}
        </div>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {tasks.map(task => (
          <TaskCard
            key={task.id} task={task}
            onUpdate={onUpdateTask} onDelete={onDeleteTask}
            onFocus={onFocusTask} onSnooze={onSnoozeTask}
            isCompany team={team}
            statusLabel={colName(task.column_id)}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-xs text-surface-200/25 px-1 py-2">Drag a task here to assign it</p>
        )}
      </div>
    </div>
  );
}

// ─── Board type selector ─────────────────────────────────
function TypePick({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      <button type="button" onClick={() => onChange('personal')}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
          value === 'personal' ? 'border-brand-500/50 bg-brand-600/15 text-brand-300 font-medium' : 'border-surface-200/10 text-surface-200/40 hover:text-white'
        }`}>
        <User size={12} /> Personal
      </button>
      <button type="button" onClick={() => onChange('company')}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
          value === 'company' ? 'border-brand-500/50 bg-brand-600/15 text-brand-300 font-medium' : 'border-surface-200/10 text-surface-200/40 hover:text-white'
        }`}>
        <Users size={12} /> Company
      </button>
    </div>
  );
}

// ─── Project chip with menu (rename / delete) ────────────
function ProjectChip({ project, active, onSelect, onRename, onDelete }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const [confirming, setConfirming] = useState(false);

  function saveRename(e) {
    e?.preventDefault();
    if (name.trim() && name.trim() !== project.name) onRename(project.id, name.trim());
    setRenaming(false); setMenu(false);
  }

  if (renaming) {
    return (
      <form onSubmit={saveRename} className="flex items-center gap-1">
        <input
          autoFocus value={name}
          onChange={e => setName(e.target.value)}
          onBlur={saveRename}
          onKeyDown={e => { if (e.key === 'Escape') { setName(project.name); setRenaming(false); } }}
          className="bg-surface-800 border border-brand-500/40 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none w-36"
        />
      </form>
    );
  }

  return (
    <div className="relative group/chip">
      <button
        onClick={() => onSelect(project.id)}
        className={`flex items-center gap-2 pl-3 pr-7 py-1.5 rounded-lg text-sm transition-all ${
          active
            ? 'bg-surface-200/15 text-white font-medium ring-1 ring-surface-200/20'
            : 'text-surface-200/50 hover:text-white hover:bg-surface-200/10'
        }`}
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project.color }} />
        {project.name}
        {project.type === 'company' && <Users size={11} className="text-surface-200/30" />}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setMenu(!menu); setConfirming(false); }}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-surface-200/25 hover:text-surface-200/70 transition ${active ? 'opacity-100' : 'opacity-0 group-hover/chip:opacity-100'}`}
      >
        <MoreHorizontal size={13} />
      </button>
      {menu && (
        <div className="absolute left-0 top-9 bg-surface-800 border border-surface-200/20 rounded-lg shadow-xl shadow-black/40 py-1 z-30 w-44 animate-slide-up">
          <button onClick={() => { setRenaming(true); setMenu(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-surface-200/60 hover:bg-surface-200/10 flex items-center gap-2">
            <Pencil size={12} /> Rename
          </button>
          {confirming ? (
            <button onClick={() => { onDelete(project.id); setMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 flex items-center gap-2">
              <Trash2 size={12} /> Really delete?
            </button>
          ) : (
            <button onClick={() => setConfirming(true)}
              className="w-full text-left px-3 py-1.5 text-xs text-red-400/70 hover:bg-red-500/10 flex items-center gap-2">
              <Trash2 size={12} /> Delete board
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Project Picker ──────────────────────────────────────
function ProjectPicker({ projects, activeId, onSelect, onCreate, onRename, onDelete }) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [type, setType] = useState('personal');

  function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), color, type);
    setName(''); setShowNew(false); setType('personal');
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {projects.map(p => (
        <ProjectChip
          key={p.id} project={p} active={p.id === activeId}
          onSelect={onSelect} onRename={onRename} onDelete={onDelete}
        />
      ))}

      {showNew ? (
        <form onSubmit={handleCreate} className="flex items-center gap-2.5 animate-slide-up flex-wrap bg-surface-900/50 border border-surface-200/10 rounded-xl px-3 py-2">
          <TypePick value={type} onChange={setType} />
          <div className="flex gap-1">
            {PROJECT_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`w-4 h-4 rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-900' : 'opacity-50 hover:opacity-100'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <input
            autoFocus value={name}
            onChange={e => setName(e.target.value)}
            placeholder={type === 'company' ? 'Team project name...' : 'Project name...'}
            className="bg-surface-800 border border-surface-200/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-surface-200/30 outline-none focus:border-brand-500/50 w-44"
            onKeyDown={e => { if (e.key === 'Escape') setShowNew(false); }}
          />
          <button type="submit" disabled={!name.trim()} className="text-brand-400 hover:text-brand-300 disabled:opacity-30">
            <CheckCircle2 size={18} />
          </button>
          <button type="button" onClick={() => setShowNew(false)} className="text-surface-200/30 hover:text-surface-200/60">
            <X size={16} />
          </button>
        </form>
      ) : (
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-surface-200/40 hover:text-brand-400 hover:bg-brand-600/10 transition border border-dashed border-surface-200/10 hover:border-brand-500/30">
          <Plus size={14} /> New Board
        </button>
      )}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────
function EmptyState({ onCreate }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('personal');
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-20 h-20 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-6">
        <FolderKanban size={40} className="text-brand-400" />
      </div>
      <h2 className="text-xl font-bold mb-2">No boards yet</h2>
      <p className="text-surface-200/40 text-sm mb-5 text-center max-w-xs">
        Create your first board. Keep it simple — you can always add more later.
      </p>
      <div className="mb-4"><TypePick value={type} onChange={setType} /></div>
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onCreate(name.trim(), PROJECT_COLORS[0], type); }} className="flex gap-2">
        <input
          autoFocus value={name}
          onChange={e => setName(e.target.value)}
          placeholder={type === 'company' ? 'e.g. "Warehouse Move" or "Ops"' : 'e.g. "Patient Orders" or "This Week"'}
          className="bg-surface-800 border border-surface-200/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-200/30 outline-none focus:border-brand-500/50 w-72"
        />
        <button type="submit" disabled={!name.trim()} className="btn-primary rounded-xl disabled:opacity-30">Create</button>
      </form>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────
export default function ProjectsView() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);
  const [energyFilter, setEnergyFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState(null);
  const [viewMode, setViewMode] = useState('status'); // 'status' | 'people'
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [doneToday, setDoneToday] = useState(0);

  // Load projects
  useEffect(() => {
    (async () => {
      try {
        const { projects: list } = await api.projectsList();
        setProjects(list);
        if (list.length > 0) setActiveProjectId(list[0].id);
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load board
  useEffect(() => {
    if (!activeProjectId) return;
    setPersonFilter(null);
    setViewMode('status');
    (async () => {
      setBoardLoading(true);
      try {
        const data = await api.projectBoard(activeProjectId);
        setColumns(data.columns);
        setTasks(data.tasks);
      } catch (err) {
        console.error('Failed to load board:', err);
      } finally {
        setBoardLoading(false);
      }
    })();
  }, [activeProjectId]);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const isCompany = activeProject?.type === 'company';

  // ── Project actions ──
  async function createProject(name, color, type) {
    try {
      const { project } = await api.projectCreate(name, color, type);
      setProjects(prev => [...prev, project]);
      setActiveProjectId(project.id);
      const data = await api.projectBoard(project.id);
      setColumns(data.columns);
      setTasks(data.tasks);
    } catch (err) { console.error('Create project error:', err); }
  }

  async function renameProject(id, name) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    try { await api.projectUpdate(id, { name }); }
    catch (err) { console.error('Rename project error:', err); }
  }

  async function deleteProject(id) {
    const remaining = projects.filter(p => p.id !== id);
    setProjects(remaining);
    if (activeProjectId === id) {
      setActiveProjectId(remaining[0]?.id || null);
      if (remaining.length === 0) { setColumns([]); setTasks([]); }
    }
    try { await api.projectDelete(id); }
    catch (err) {
      console.error('Delete project error:', err);
      const { projects: list } = await api.projectsList();
      setProjects(list);
    }
  }

  // ── Task actions ──
  async function addTask(title, columnId) {
    try {
      const { task } = await api.projectTaskCreate(activeProjectId, { title, column_id: columnId });
      setTasks(prev => [...prev, task]);
    } catch (err) { console.error('Add task error:', err); }
  }

  function addToDo(title) {
    const firstCol = columns[0];
    if (firstCol) addTask(title, firstCol.id);
  }

  async function updateTask(taskId, updates, opts = {}) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    if (opts.celebrate) {
      setCelebrate(true);
      setDoneToday(n => n + 1);
    }
    if (opts.skipServer) return;
    try {
      await api.projectTaskUpdate(activeProjectId, taskId, updates);
    } catch (err) {
      console.error('Update task error:', err);
      const data = await api.projectBoard(activeProjectId);
      setTasks(data.tasks);
    }
  }

  async function deleteTask(taskId) {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try { await api.projectTaskDelete(activeProjectId, taskId); }
    catch (err) { console.error('Delete task error:', err); }
  }

  async function moveTask(taskId, newColumnId) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: newColumnId } : t));
    try { await api.projectTaskMove(activeProjectId, taskId, { column_id: newColumnId, sort_order: 0 }); }
    catch (err) {
      console.error('Move task error:', err);
      const data = await api.projectBoard(activeProjectId);
      setTasks(data.tasks);
    }
  }

  function snoozeTask(taskId, days) {
    const until = new Date();
    until.setDate(until.getDate() + days);
    until.setHours(6, 0, 0, 0);
    updateTask(taskId, { snoozed_until: until.toISOString() });
  }

  // ── Focus mode ──
  const focusQueue = useMemo(() => rankTasks(tasks, columns), [tasks, columns]);

  function enterFocus(taskId = null) {
    if (taskId) {
      const idx = focusQueue.findIndex(t => t.id === taskId);
      setFocusIndex(idx >= 0 ? idx : 0);
    } else {
      setFocusIndex(0);
    }
    setFocusMode(true);
  }

  function completeFromFocus(taskId) {
    updateTask(taskId, { completed: true }, { celebrate: true });
  }

  // ── Derived ──
  const team = useMemo(() => {
    const names = new Set(tasks.map(t => t.assignee).filter(Boolean));
    return [...names].sort();
  }, [tasks]);

  const peopleStats = useMemo(() => team.map(name => {
    const theirs = tasks.filter(t => t.assignee === name && !t.completed);
    return { name, open: theirs.length, overdue: theirs.filter(isOverdue).length };
  }), [team, tasks]);

  const unassignedCount = tasks.filter(t => !t.assignee && !t.completed).length;

  const visibleTasks = useMemo(() => tasks.filter(t => {
    if (!showSnoozed && isSnoozed(t)) return false;
    if (energyFilter !== 'all' && (t.energy || 'normal') !== energyFilter && !t.completed) return false;
    if (personFilter === '__unassigned__' && t.assignee) return false;
    if (personFilter && personFilter !== '__unassigned__' && t.assignee !== personFilter) return false;
    return true;
  }), [tasks, showSnoozed, energyFilter, personFilter]);

  const snoozedCount = tasks.filter(isSnoozed).length;
  const overdueTasks = tasks.filter(t => isOverdue(t) && !isSnoozed(t));
  const completedToday = useMemo(() => tasks.filter(t => {
    if (!t.completed) return false;
    const d = new Date((t.updated_at || '').replace(' ', 'T') + 'Z');
    return d.toDateString() === new Date().toDateString();
  }).length, [tasks]);
  const doneCount = Math.max(doneToday, completedToday);

  // ── Render ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Sparkles size={24} className="text-brand-400 animate-spin" />
      </div>
    );
  }

  if (projects.length === 0) {
    return <EmptyState onCreate={createProject} />;
  }

  return (
    <div className="space-y-4">
      {celebrate && <ConfettiBurst onDone={() => setCelebrate(false)} />}

      {focusMode && (
        <FocusOverlay
          queue={focusQueue}
          queueIndex={Math.min(focusIndex, Math.max(0, focusQueue.length - 1))}
          onNext={() => setFocusIndex(i => (focusQueue.length ? (i + 1) % focusQueue.length : 0))}
          onClose={() => setFocusMode(false)}
          onUpdate={updateTask}
          onComplete={completeFromFocus}
          onSnooze={snoozeTask}
          projectId={activeProjectId}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FolderKanban size={24} className="text-brand-400" />
          <h1 className="text-xl font-bold">Projects</h1>
          {doneCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-good bg-good/10 px-2.5 py-1 rounded-full font-medium">
              <Flame size={12} /> {doneCount} done today
            </span>
          )}
        </div>

        <button
          onClick={() => enterFocus()}
          disabled={focusQueue.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition disabled:opacity-30 shadow-lg shadow-brand-600/20"
        >
          <Target size={16} /> What should I do now?
        </button>
      </div>

      {/* Add a to do */}
      <AddToDo onAdd={addToDo} />

      {/* Overdue strip */}
      {overdueTasks.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
          <span className="text-xs text-red-400 font-semibold flex items-center gap-1">
            <AlertTriangle size={12} /> {overdueTasks.length} overdue:
          </span>
          {overdueTasks.slice(0, 3).map(t => (
            <button key={t.id} onClick={() => enterFocus(t.id)}
              className="text-xs text-red-300/80 hover:text-white bg-red-500/10 hover:bg-red-500/20 rounded-lg px-2 py-1 transition truncate max-w-[200px]">
              {t.assignee ? `${t.assignee}: ` : ''}{t.title}
            </button>
          ))}
          {overdueTasks.length > 3 && <span className="text-xs text-red-400/50">+{overdueTasks.length - 3} more</span>}
        </div>
      )}

      {/* Project tabs */}
      <ProjectPicker
        projects={projects} activeId={activeProjectId}
        onSelect={setActiveProjectId} onCreate={createProject}
        onRename={renameProject} onDelete={deleteProject}
      />

      {/* Company: people bar + view toggle */}
      {isCompany && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg bg-surface-900/50 border border-surface-200/10 p-0.5">
            <button onClick={() => setViewMode('status')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition ${viewMode === 'status' ? 'bg-surface-200/15 text-white font-medium' : 'text-surface-200/40 hover:text-white'}`}>
              <Columns3 size={12} /> By status
            </button>
            <button onClick={() => setViewMode('people')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition ${viewMode === 'people' ? 'bg-surface-200/15 text-white font-medium' : 'text-surface-200/40 hover:text-white'}`}>
              <Users size={12} /> By person
            </button>
          </div>

          {peopleStats.map(p => (
            <button key={p.name}
              onClick={() => setPersonFilter(personFilter === p.name ? null : p.name)}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition ${
                personFilter === p.name ? 'bg-brand-600/30 text-white ring-1 ring-brand-500/40 font-medium' : 'bg-surface-200/5 text-surface-200/50 hover:text-white hover:bg-surface-200/10'
              }`}
              title={`${p.name}: ${p.open} open${p.overdue ? `, ${p.overdue} overdue` : ''}`}
            >
              <Avatar name={p.name} size={16} />
              {p.name}
              <span className="text-surface-200/40">{p.open}</span>
              {p.overdue > 0 && <span className="text-red-400 font-semibold">!{p.overdue}</span>}
            </button>
          ))}
          {unassignedCount > 0 && (
            <button
              onClick={() => setPersonFilter(personFilter === '__unassigned__' ? null : '__unassigned__')}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition ${
                personFilter === '__unassigned__' ? 'bg-brand-600/30 text-white ring-1 ring-brand-500/40 font-medium' : 'bg-surface-200/5 text-surface-200/40 hover:text-white hover:bg-surface-200/10'
              }`}
            >
              <User size={12} /> Unassigned <span className="text-surface-200/40">{unassignedCount}</span>
            </button>
          )}
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        {!isCompany && (
          <>
            <span className="text-xs text-surface-200/30">Brain right now:</span>
            <div className="flex gap-1">
              {[['all', 'Show all'], ['low', '🥱 Low'], ['normal', '🙂 OK'], ['high', '⚡ Fired up']].map(([key, label]) => (
                <button key={key} onClick={() => setEnergyFilter(key)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition ${
                    energyFilter === key ? 'bg-brand-600/30 text-brand-300 font-medium' : 'text-surface-200/40 hover:text-white hover:bg-surface-200/10'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
        {snoozedCount > 0 && (
          <button onClick={() => setShowSnoozed(!showSnoozed)}
            className="flex items-center gap-1.5 text-xs text-surface-200/40 hover:text-white transition ml-auto">
            {showSnoozed ? <EyeOff size={12} /> : <Eye size={12} />}
            {showSnoozed ? 'Hide' : 'Show'} {snoozedCount} snoozed
          </button>
        )}
      </div>

      {/* Board */}
      {boardLoading ? (
        <div className="flex items-center justify-center py-16">
          <Sparkles size={20} className="text-brand-400 animate-spin mr-2" />
          <span className="text-surface-200/40 text-sm">Loading board...</span>
        </div>
      ) : isCompany && viewMode === 'people' ? (
        <div className="flex gap-4 overflow-x-auto pb-4" data-focus-group>
          {[...team, '__unassigned__'].map(person => {
            const personTasks = visibleTasks
              .filter(t => person === '__unassigned__' ? !t.assignee : t.assignee === person)
              .filter(t => !t.completed)
              .sort((a, b) => {
                if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
                if (a.due_date) return -1;
                if (b.due_date) return 1;
                return a.sort_order - b.sort_order;
              });
            if (person === '__unassigned__' && personTasks.length === 0 && team.length > 0) return null;
            return (
              <PersonColumn
                key={person} person={person}
                tasks={personTasks} columns={columns}
                onUpdateTask={updateTask} onDeleteTask={deleteTask}
                onFocusTask={enterFocus} onSnoozeTask={snoozeTask}
                team={team}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" data-focus-group>
          {columns.map(col => {
            const colTasks = visibleTasks
              .filter(t => t.column_id === col.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            const hiddenCount = tasks.filter(t => t.column_id === col.id).length - colTasks.length;
            return (
              <KanbanColumn
                key={col.id} column={col}
                tasks={colTasks} hiddenCount={hiddenCount}
                onAddTask={addTask} onUpdateTask={updateTask}
                onDeleteTask={deleteTask} onMoveTask={moveTask}
                onFocusTask={enterFocus} onSnoozeTask={snoozeTask}
                isCompany={isCompany} team={team}
              />
            );
          })}
        </div>
      )}

      {/* Stats bar */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-surface-200/30 pt-2 border-t border-surface-200/5">
          <span>{tasks.length} total</span>
          <span>{tasks.filter(t => t.completed).length} completed</span>
          <span>{tasks.filter(t => (t.priority === 'urgent' || t.priority === 'high') && !t.completed).length} high priority</span>
          {overdueTasks.length > 0 && <span className="text-red-400/60">{overdueTasks.length} overdue</span>}
          {snoozedCount > 0 && <span>{snoozedCount} snoozed</span>}
          {isCompany && team.length > 0 && <span>{team.length} people</span>}
        </div>
      )}
    </div>
  );
}
