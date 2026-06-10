import React, { useState, useEffect } from 'react';
import {
  Trash2, RotateCcw, Loader, FolderKanban, CheckCircle2,
  StickyNote, Paperclip, AlertTriangle, X, Users, User
} from 'lucide-react';
import { api } from '../../services/api';
import { timeAgo } from '../../utils/time';



function fmtSize(b) {
  if (!b) return '';
  if (b > 1024 * 1024) return `${(b / 1048576).toFixed(1)} MB`;
  return `${Math.ceil(b / 1024)} KB`;
}

function TrashRow({ icon: Icon, iconColor, title, subtitle, deletedAt, onRestore, onPurge }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="group flex items-center gap-3 bg-surface-800 border border-surface-200/10 rounded-xl px-4 py-3">
      <Icon size={16} className={`${iconColor} shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{title}</p>
        {subtitle && <p className="text-xs text-surface-200/40 truncate">{subtitle}</p>}
      </div>
      {deletedAt && <span className="text-xs text-surface-200/30 shrink-0">{timeAgo(deletedAt)}</span>}
      <button
        onClick={onRestore}
        className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 bg-brand-600/10 hover:bg-brand-600/20 rounded-lg px-2.5 py-1.5 transition shrink-0"
      >
        <RotateCcw size={12} /> Restore
      </button>
      {confirming ? (
        <button
          onClick={onPurge}
          onBlur={() => setConfirming(false)}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg px-2.5 py-1.5 transition shrink-0"
        >
          <Trash2 size={12} /> Forever?
        </button>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          title="Delete permanently"
          className="text-surface-200/25 hover:text-red-400 transition shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function Section({ title, count, children }) {
  if (count === 0) return null;
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-surface-200/30 font-semibold mb-2">
        {title} <span className="text-surface-200/20">({count})</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function TrashView() {
  const [data, setData] = useState({ projects: [], tasks: [], notes: [], attachments: [] });
  const [loading, setLoading] = useState(true);
  const [emptying, setEmptying] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [message, setMessage] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const d = await api.trashList();
      setData({ projects: d.projects || [], tasks: d.tasks || [], notes: d.notes || [], attachments: d.attachments || [] });
    } catch (e) {
      console.error('Trash load error:', e);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const total = data.projects.length + data.tasks.length + data.notes.length + data.attachments.length;

  async function restore(type, id) {
    try {
      await api.trashRestore(type, id);
      setMessage('Restored ✓');
      setTimeout(() => setMessage(null), 2000);
      load();
    } catch (e) { console.error(e); }
  }

  async function purge(type, id) {
    try {
      await api.trashPurgeItem(type, id);
      load();
    } catch (e) { console.error(e); }
  }

  async function emptyTrash() {
    setEmptying(true);
    try {
      const r = await api.trashEmpty();
      const c = r.purged || {};
      setMessage(`Trash emptied — ${(c.projects || 0) + (c.tasks || 0) + (c.notes || 0) + (c.attachments || 0)} items permanently deleted`);
      setTimeout(() => setMessage(null), 4000);
      setConfirmEmpty(false);
      load();
    } catch (e) { console.error(e); }
    setEmptying(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Trash2 size={24} className="text-surface-200/50" />
          <h1 className="text-xl font-bold">Trash</h1>
          {total > 0 && (
            <span className="text-xs text-surface-200/40 bg-surface-200/5 px-2 py-1 rounded-full">{total} items</span>
          )}
          {message && <span className="text-xs text-good animate-slide-up">{message}</span>}
        </div>

        {total > 0 && (
          confirmEmpty ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle size={12} /> This permanently deletes everything here. No undo.
              </span>
              <button
                onClick={emptyTrash}
                disabled={emptying}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {emptying ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Yes, empty trash
              </button>
              <button onClick={() => setConfirmEmpty(false)} className="text-surface-200/40 hover:text-white p-2">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmEmpty(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200/10 hover:bg-red-600/20 text-surface-200/60 hover:text-red-400 text-sm font-medium transition"
            >
              <Trash2 size={14} /> Empty Trash
            </button>
          )
        )}
      </div>

      <p className="text-sm text-surface-200/40">
        Deleted boards, tasks, notes, and file attachments land here. Restore anything, or empty the trash to delete permanently.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size={24} className="animate-spin text-brand-500" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-surface-200/5 flex items-center justify-center mb-4">
            <Trash2 size={28} className="text-surface-200/20" />
          </div>
          <p className="text-surface-200/30">Trash is empty</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
          <Section title="Boards" count={data.projects.length}>
            {data.projects.map(p => (
              <TrashRow
                key={`p-${p.id}`}
                icon={p.type === 'company' ? Users : FolderKanban}
                iconColor="text-brand-400"
                title={p.name}
                subtitle={p.type === 'company' ? 'Company board (tasks restore with it)' : 'Personal board (tasks restore with it)'}
                deletedAt={p.deleted_at}
                onRestore={() => restore('project', p.id)}
                onPurge={() => purge('project', p.id)}
              />
            ))}
          </Section>

          <Section title="Tasks" count={data.tasks.length}>
            {data.tasks.map(t => (
              <TrashRow
                key={`t-${t.id}`}
                icon={CheckCircle2}
                iconColor="text-good"
                title={t.title}
                subtitle={t.project_name ? `from ${t.project_name}${t.project_archived ? ' (board also in trash)' : ''}` : null}
                deletedAt={t.deleted_at}
                onRestore={() => restore('task', t.id)}
                onPurge={() => purge('task', t.id)}
              />
            ))}
          </Section>

          <Section title="Parking Lot notes" count={data.notes.length}>
            {data.notes.map(n => (
              <TrashRow
                key={`n-${n.id}`}
                icon={StickyNote}
                iconColor="text-amber-400"
                title={n.text?.slice(0, 80) || '(empty note)'}
                deletedAt={n.deleted_at}
                onRestore={() => restore('note', n.id)}
                onPurge={() => purge('note', n.id)}
              />
            ))}
          </Section>

          <Section title="File attachments" count={data.attachments.length}>
            {data.attachments.map(a => (
              <TrashRow
                key={`a-${a.id}`}
                icon={Paperclip}
                iconColor="text-blue-400"
                title={a.original_name}
                subtitle={`${a.question_headline ? `from "${a.question_headline}"` : 'Team Request file'}${a.size ? ` · ${fmtSize(a.size)}` : ''}`}
                deletedAt={a.deleted_at}
                onRestore={() => restore('attachment', a.id)}
                onPurge={() => purge('attachment', a.id)}
              />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}
