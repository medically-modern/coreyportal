import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  CheckCircle2, Clock, Zap, AlertTriangle, MoreHorizontal,
  X, FolderKanban, Sparkles, Edit3, Calendar
} from 'lucide-react';
import { api } from '../../services/api';

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

const PRIORITY_META = {
  low:    { icon: Clock,          color: 'text-surface-200/40', bg: 'bg-surface-200/5',   label: 'Low' },
  normal: { icon: ChevronRight,   color: 'text-blue-400',       bg: 'bg-blue-500/10',     label: 'Normal' },
  high:   { icon: AlertTriangle,  color: 'text-amber-400',      bg: 'bg-amber-500/10',    label: 'High' },
  urgent: { icon: Zap,            color: 'text-red-400',        bg: 'bg-red-500/10',      label: 'Urgent' },
};

// ─── Quick Add Input ─────────────────────────────────────
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
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-surface-900/50 border border-surface-200/10 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-200/30 outline-none focus:border-brand-500/50 transition"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="px-3 py-2 bg-brand-600/20 text-brand-400 rounded-lg hover:bg-brand-600/30 disabled:opacity-30 transition"
      >
        <Plus size={16} />
      </button>
    </form>
  );
}

// ─── Task Card ───────────────────────────────────────────
function TaskCard({ task, onUpdate, onDelete, onDragStart, projectId }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [desc, setDesc] = useState(task.description || '');
  const pri = PRIORITY_META[task.priority] || PRIORITY_META.normal;
  const PriIcon = pri.icon;

  function saveTitle() {
    if (title.trim() && title !== task.title) {
      onUpdate(task.id, { title: title.trim() });
    }
    setEditing(false);
  }

  function saveDesc() {
    if (desc !== task.description) {
      onUpdate(task.id, { description: desc });
    }
    setShowDesc(false);
  }

  function cyclePriority() {
    const order = ['low', 'normal', 'high', 'urgent'];
    const next = order[(order.indexOf(task.priority) + 1) % order.length];
    onUpdate(task.id, { priority: next });
  }

  function toggleComplete() {
    onUpdate(task.id, { completed: !task.completed });
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', String(task.id));
        e.dataTransfer.setData('fromColumn', String(task.column_id));
        onDragStart?.(task.id);
      }}
      className={`group relative bg-surface-800 border rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all hover:border-surface-200/30 ${
        task.completed ? 'opacity-50 border-surface-200/5' : isOverdue ? 'border-red-500/30 animate-pulse-subtle' : 'border-surface-200/10'
      }`}
    >
      {/* Grip + Complete toggle row */}
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-surface-200/20 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition" />

        <button onClick={toggleComplete} className="mt-0.5 shrink-0">
          <CheckCircle2 size={16} className={task.completed ? 'text-good' : 'text-surface-200/20 hover:text-good/60'} />
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(task.title); setEditing(false); } }}
              className="w-full bg-transparent text-sm text-white outline-none border-b border-brand-500/50"
            />
          ) : (
            <p
              onClick={() => setEditing(true)}
              className={`text-sm leading-snug cursor-text ${task.completed ? 'line-through text-surface-200/40' : 'text-white'}`}
            >
              {task.title}
            </p>
          )}

          {/* Tags row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <button
              onClick={cyclePriority}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${pri.bg} ${pri.color} hover:opacity-80 transition`}
              title="Click to change priority"
            >
              <PriIcon size={10} /> {pri.label}
            </button>

            {task.due_date && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-surface-200/5 text-surface-200/40'}`}>
                <Calendar size={8} className="inline mr-0.5" />
                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}

            {task.description && !showDesc && (
              <button onClick={() => setShowDesc(true)} className="text-[10px] text-surface-200/25 hover:text-surface-200/50">
                <Edit3 size={10} className="inline" /> note
              </button>
            )}
          </div>

          {/* Expandable description */}
          {showDesc && (
            <div className="mt-2">
              <textarea
                autoFocus
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onBlur={saveDesc}
                placeholder="Add a note..."
                className="w-full bg-surface-900/50 border border-surface-200/10 rounded-lg px-2 py-1.5 text-xs text-surface-200/70 placeholder-surface-200/20 outline-none focus:border-brand-500/30 resize-none"
                rows={2}
              />
            </div>
          )}
        </div>

        {/* Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-surface-200/20 hover:text-surface-200/60 opacity-0 group-hover:opacity-100 transition"
          >
            <MoreHorizontal size={14} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 bg-surface-800 border border-surface-200/20 rounded-lg shadow-xl shadow-black/40 py-1 z-20 w-36 animate-slide-up">
              <button
                onClick={() => { setShowDesc(true); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-surface-200/60 hover:bg-surface-200/10 flex items-center gap-2"
              >
                <Edit3 size={12} /> Add note
              </button>
              <button
                onClick={() => {
                  const date = prompt('Due date (YYYY-MM-DD):');
                  if (date) onUpdate(task.id, { due_date: date });
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-surface-200/60 hover:bg-surface-200/10 flex items-center gap-2"
              >
                <Calendar size={12} /> Set due date
              </button>
              <button
                onClick={() => { onDelete(task.id); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-400/70 hover:bg-red-500/10 flex items-center gap-2"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Column ───────────────────────────────────────
function KanbanColumn({ column, tasks, onAddTask, onUpdateTask, onDeleteTask, onMoveTask, isLast, projectId }) {
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

  const doneColumn = column.name.toLowerCase().includes('done') || column.name.toLowerCase().includes('complete');
  const taskCount = tasks.length;
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div
      className={`flex-1 min-w-[260px] max-w-[340px] flex flex-col rounded-2xl transition-all ${
        dragOver ? 'bg-brand-600/10 ring-2 ring-brand-500/30' : 'bg-surface-900/30'
      }`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-surface-200/70">{column.name}</h3>
          <span className="text-[10px] text-surface-200/30 bg-surface-200/5 px-1.5 py-0.5 rounded-full">
            {taskCount}
          </span>
        </div>
        {doneColumn && completedCount > 0 && (
          <span className="text-[10px] text-good/60">{completedCount} done</span>
        )}
      </div>

      {/* Tasks */}
      <div className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            projectId={projectId}
            onUpdate={onUpdateTask}
            onDelete={onDeleteTask}
          />
        ))}

        {/* Quick add at bottom of column */}
        <QuickAdd
          placeholder={`+ Add to ${column.name}...`}
          onAdd={(title) => onAddTask(title, column.id)}
        />
      </div>
    </div>
  );
}

// ─── Project Selector / Creator ──────────────────────────
function ProjectPicker({ projects, activeId, onSelect, onCreate }) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), color);
    setName('');
    setShowNew(false);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {projects.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
            p.id === activeId
              ? 'bg-surface-200/15 text-white font-medium ring-1 ring-surface-200/20'
              : 'text-surface-200/50 hover:text-white hover:bg-surface-200/10'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}
        </button>
      ))}

      {showNew ? (
        <form onSubmit={handleCreate} className="flex items-center gap-2 animate-slide-up">
          <div className="flex gap-1">
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-4 h-4 rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-900' : 'opacity-50 hover:opacity-100'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Project name..."
            className="bg-surface-800 border border-surface-200/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-surface-200/30 outline-none focus:border-brand-500/50 w-40"
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
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-surface-200/40 hover:text-brand-400 hover:bg-brand-600/10 transition border border-dashed border-surface-200/10 hover:border-brand-500/30"
        >
          <Plus size={14} /> New Board
        </button>
      )}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────
function EmptyState({ onCreate }) {
  const [name, setName] = useState('');

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-20 h-20 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-6">
        <FolderKanban size={40} className="text-brand-400" />
      </div>
      <h2 className="text-xl font-bold mb-2">No boards yet</h2>
      <p className="text-surface-200/40 text-sm mb-6 text-center max-w-xs">
        Create your first board. Keep it simple — you can always add more later.
      </p>
      <form
        onSubmit={e => { e.preventDefault(); if (name.trim()) onCreate(name.trim(), PROJECT_COLORS[0]); }}
        className="flex gap-2"
      >
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder='e.g. "Patient Orders" or "This Week"'
          className="bg-surface-800 border border-surface-200/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-200/30 outline-none focus:border-brand-500/50 w-72"
        />
        <button type="submit" disabled={!name.trim()} className="btn-primary rounded-xl disabled:opacity-30">
          Create
        </button>
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

  // Load projects list
  useEffect(() => {
    (async () => {
      try {
        const { projects: list } = await api.projectsList();
        setProjects(list);
        if (list.length > 0) {
          setActiveProjectId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load board when active project changes
  useEffect(() => {
    if (!activeProjectId) return;
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

  // ── Actions ──

  async function createProject(name, color) {
    try {
      const { project } = await api.projectCreate(name, color);
      setProjects(prev => [...prev, project]);
      setActiveProjectId(project.id);
      // Load the new board
      const data = await api.projectBoard(project.id);
      setColumns(data.columns);
      setTasks(data.tasks);
    } catch (err) {
      console.error('Create project error:', err);
    }
  }

  async function addTask(title, columnId) {
    try {
      const { task } = await api.projectTaskCreate(activeProjectId, {
        title,
        column_id: columnId,
      });
      setTasks(prev => [...prev, task]);
    } catch (err) {
      console.error('Add task error:', err);
    }
  }

  async function updateTask(taskId, updates) {
    // Optimistic
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    try {
      await api.projectTaskUpdate(activeProjectId, taskId, updates);
    } catch (err) {
      console.error('Update task error:', err);
      // Reload on error
      const data = await api.projectBoard(activeProjectId);
      setTasks(data.tasks);
    }
  }

  async function deleteTask(taskId) {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await api.projectTaskDelete(activeProjectId, taskId);
    } catch (err) {
      console.error('Delete task error:', err);
    }
  }

  async function moveTask(taskId, newColumnId) {
    // Optimistic
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: newColumnId } : t));
    try {
      await api.projectTaskMove(activeProjectId, taskId, { column_id: newColumnId, sort_order: 0 });
    } catch (err) {
      console.error('Move task error:', err);
      const data = await api.projectBoard(activeProjectId);
      setTasks(data.tasks);
    }
  }

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

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderKanban size={24} className="text-brand-400" />
          <h1 className="text-xl font-bold">Projects</h1>
        </div>
      </div>

      {/* Project tabs */}
      <ProjectPicker
        projects={projects}
        activeId={activeProjectId}
        onSelect={setActiveProjectId}
        onCreate={createProject}
      />

      {/* Board */}
      {boardLoading ? (
        <div className="flex items-center justify-center py-16">
          <Sparkles size={20} className="text-brand-400 animate-spin mr-2" />
          <span className="text-surface-200/40 text-sm">Loading board...</span>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" data-focus-group>
          {columns.map((col, i) => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={tasks.filter(t => t.column_id === col.id).sort((a, b) => a.sort_order - b.sort_order)}
              onAddTask={addTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onMoveTask={moveTask}
              isLast={i === columns.length - 1}
              projectId={activeProjectId}
            />
          ))}
        </div>
      )}

      {/* Stats bar */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-surface-200/30 pt-2 border-t border-surface-200/5">
          <span>{tasks.length} total tasks</span>
          <span>{tasks.filter(t => t.completed).length} completed</span>
          <span>{tasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length} high priority</span>
          {tasks.some(t => t.due_date && new Date(t.due_date) < new Date() && !t.completed) && (
            <span className="text-red-400/60">
              {tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && !t.completed).length} overdue
            </span>
          )}
        </div>
      )}
    </div>
  );
}
