import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader, X, User, Tag, ArrowUpDown, Archive, RotateCcw, Paperclip, Download, FileText, Zap, LayoutList, SkipForward, AlarmClock, CheckCircle2, Clock, Eye, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import { timeAgo } from '../../utils/time';

const URGENCY_CONFIG = {
  emergency:  { label: 'EMERGENCY', bg: 'bg-red-700',       border: 'border-red-700',       text: 'text-red-100',    dot: 'bg-red-500',    glow: 'shadow-lg shadow-red-500/20',    order: 0 },
  super_high: { label: 'SUPER HIGH', bg: 'bg-red-600/80',    border: 'border-red-600',       text: 'text-red-100',    dot: 'bg-red-400',    glow: 'shadow-lg shadow-red-400/20',    order: 1 },
  high:       { label: 'HIGH',       bg: 'bg-orange-600/60', border: 'border-orange-500',    text: 'text-orange-100', dot: 'bg-orange-400', glow: 'shadow-lg shadow-orange-400/15', order: 2 },
  medium:     { label: 'MEDIUM',     bg: 'bg-amber-600/40',  border: 'border-amber-500/50',  text: 'text-amber-100',  dot: 'bg-amber-400', glow: '',                               order: 3 },
  low:        { label: 'LOW',        bg: 'bg-blue-600/30',   border: 'border-blue-500/30',   text: 'text-blue-200',   dot: 'bg-blue-400',  glow: '',                               order: 4 },
  very_low:   { label: 'VERY LOW',   bg: 'bg-slate-600/20',  border: 'border-slate-500/20',  text: 'text-slate-300',  dot: 'bg-slate-400', glow: '',                               order: 5 },
  normal:     { label: 'NORMAL',     bg: 'bg-surface-200/5', border: 'border-surface-200/10',text: 'text-surface-200/60', dot: 'bg-surface-200/40', glow: '',                       order: 3 },
};

function getUrgency(q) {
  return URGENCY_CONFIG[q.priority || q.urgency || 'normal'] || URGENCY_CONFIG.normal;
}

// Parse "[Patient: X] question \n\nContext: ..." structure
function parseQuestion(q) {
  const qText = q.question || '';
  const patientMatch = qText.match(/^\[Patient: ([^\]]+)\]\s*/);
  const patientName = patientMatch ? patientMatch[1] : null;
  const afterPatient = patientMatch ? qText.slice(patientMatch[0].length) : qText;
  const contextSplit = afterPatient.split('\n\nContext: ');
  return { patientName, mainQuestion: contextSplit[0], context: contextSplit[1] || null };
}

const SNOOZE_OPTIONS = [
  { label: '30m', ms: 30 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '2h', ms: 2 * 60 * 60 * 1000 },
  { label: '4h', ms: 4 * 60 * 60 * 1000 },
  { label: 'Tomorrow', ms: 24 * 60 * 60 * 1000 },
];

function QuestionCard({ q, onClick, onRestore }) {
  const u = getUrgency(q);
  return (
    <div
      onClick={() => onClick(q)}
      data-focus-item="" className={`rounded-xl border-2 ${u.border} ${u.bg} p-4 cursor-pointer transition-all hover:scale-[1.02] ${u.glow}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-3 h-3 rounded-full ${u.dot}`} />
          <span className={`text-xs font-black uppercase tracking-wider ${u.text}`}>{u.label}</span>
        </div>
        <span className="text-xs text-surface-200/30">{timeAgo(q.created_at)}</span>
      </div>

      <h3 className="text-base font-bold mt-2 leading-snug">
        {q.headline || q.question?.split('\n')[0]?.slice(0, 60) || 'No headline'}
      </h3>

      <div className="flex items-center justify-between mt-3 text-xs text-surface-200/40">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><User size={11} /> {q.from_name || 'Team'}</span>
          <span className="flex items-center gap-1"><Tag size={11} /> {q.tag || 'General'}</span>
          {(q.attachments?.length > 0) && (
            <span className="flex items-center gap-1 text-brand-400"><Paperclip size={11} /> {q.attachments.length}</span>
          )}
        </div>
        {q.status === 'archived' && onRestore && (
          <button onClick={(e) => { e.stopPropagation(); onRestore(q.id); }}
            className="flex items-center gap-1 text-brand-400 hover:text-brand-300 transition">
            <RotateCcw size={11} /> Restore
          </button>
        )}
      </div>
    </div>
  );
}

// File types the browser can render natively in an iframe (no download needed)
function isViewable(att) {
  const name = (att.original_name || '').toLowerCase();
  const mime = (att.mime || '').toLowerCase();
  return mime.includes('pdf') || mime.startsWith('image/') || mime.startsWith('text/')
    || /\.(pdf|png|jpe?g|gif|txt|csv)$/.test(name);
}

// ── In-site attachment viewer — renders PDFs/images inline, nothing downloads ──
function AttachmentViewer({ att, onClose }) {
  const isImage = (att.mime || '').startsWith('image/') || /\.(png|jpe?g|gif)$/i.test(att.original_name || '');
  const url = api.qaAttachmentViewUrl(att.id);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-surface-900/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full h-full max-w-5xl bg-surface-800 border border-surface-200/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-200/10 bg-surface-900/50">
          <FileText size={15} className="text-brand-400 shrink-0" />
          <span className="text-sm font-semibold truncate flex-1">{att.original_name}</span>
          <a href={api.qaAttachmentUrl(att.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200/10 hover:bg-surface-200/15 text-surface-200/70 text-xs transition" title="Download a copy">
            <Download size={12} /> Download
          </a>
          <a href={url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200/10 hover:bg-surface-200/15 text-surface-200/70 text-xs transition" title="Open in new tab">
            <ExternalLink size={12} />
          </a>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200/10 text-surface-200/50 hover:text-white transition">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 bg-surface-900/60 min-h-0">
          {isImage ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img src={url} alt={att.original_name} className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          ) : (
            <iframe src={url} title={att.original_name} className="w-full h-full border-0" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Attachments block (shared by modal + focus view) ──
function AttachmentsBlock({ question }) {
  const [attachments, setAttachments] = useState(question.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [viewing, setViewing] = useState(null);

  useEffect(() => { setAttachments(question.attachments || []); }, [question.id]);

  function fmtSize(b) {
    if (!b) return '';
    if (b > 1024 * 1024) return `${(b / 1048576).toFixed(1)} MB`;
    return `${Math.ceil(b / 1024)} KB`;
  }

  async function handleUpload(fileList) {
    if (!fileList.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { attachments: added } = await api.qaUploadAttachments(question.id, fileList, 'corey');
      setAttachments(prev => [...prev, ...added]);
    } catch (e) {
      setUploadError(e.message || 'Upload failed');
    }
    setUploading(false);
  }

  async function handleDeleteAttachment(attId) {
    setAttachments(prev => prev.filter(a => a.id !== attId));
    try { await api.qaDeleteAttachment(attId); } catch (e) { console.error(e); }
  }

  return (
    <div>
      <p className="text-xs text-surface-200/30 mb-2 uppercase tracking-wider font-medium flex items-center gap-1">
        <Paperclip size={11} /> Attachments {attachments.length > 0 && `(${attachments.length})`}
      </p>
      {attachments.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {attachments.map(att => (
            <div key={att.id} className="group flex items-center gap-2 bg-surface-200/5 hover:bg-surface-200/10 rounded-lg px-3 py-2 text-sm transition">
              <FileText size={14} className="text-brand-400 shrink-0" />
              {isViewable(att) ? (
                <button
                  onClick={() => setViewing(att)}
                  className="flex-1 truncate text-left text-surface-200/80 hover:text-white hover:underline"
                  title={`View ${att.original_name}`}
                >
                  {att.original_name}
                </button>
              ) : (
                <a
                  href={api.qaAttachmentUrl(att.id)}
                  className="flex-1 truncate text-surface-200/80 hover:text-white hover:underline"
                  title={`Download ${att.original_name}`}
                >
                  {att.original_name}
                </a>
              )}
              <span className="text-xs text-surface-200/30">{fmtSize(att.size)}</span>
              {att.uploaded_by === 'corey' && <span className="text-[10px] text-surface-200/25">you</span>}
              {isViewable(att) && (
                <button onClick={() => setViewing(att)} className="flex items-center gap-1 text-surface-200/30 hover:text-brand-400 transition text-xs" title="View in site — no download">
                  <Eye size={13} /> View
                </button>
              )}
              <a href={api.qaAttachmentUrl(att.id)} className="text-surface-200/30 hover:text-brand-400 transition" title="Download">
                <Download size={13} />
              </a>
              <button onClick={() => handleDeleteAttachment(att.id)}
                className="opacity-0 group-hover:opacity-100 text-surface-200/30 hover:text-red-400 transition" title="Delete attachment">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="inline-flex items-center gap-1.5 text-xs text-surface-200/40 hover:text-brand-400 cursor-pointer transition">
        {uploading ? <Loader size={12} className="animate-spin" /> : <Paperclip size={12} />}
        {uploading ? 'Uploading...' : 'Attach files'}
        <input
          type="file" multiple className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.heic,.gif"
          onChange={e => { handleUpload([...e.target.files]); e.target.value = ''; }}
        />
      </label>
      {uploadError && <p className="text-xs text-urgent mt-1">{uploadError}</p>}
      {viewing && <AttachmentViewer att={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function FocusModal({ question, onClose, onArchive }) {
  const u = getUrgency(question);
  const { patientName, mainQuestion, context } = parseQuestion(question);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-md" onClick={onClose} />

      <div className={`relative w-full max-w-lg rounded-2xl border-2 ${u.border} bg-surface-800 shadow-2xl overflow-hidden`}>
        <div className={`${u.bg} px-6 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${u.dot} animate-pulse`} />
            <span className={`text-sm font-black uppercase tracking-wider ${u.text}`}>{u.label}</span>
          </div>
          <button onClick={onClose} className="text-surface-200/40 hover:text-white transition"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <h2 className="text-xl font-bold leading-tight">
            {question.headline || mainQuestion?.slice(0, 80)}
          </h2>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="bg-surface-200/5 rounded-lg px-3 py-2">
              <p className="text-xs text-surface-200/30 mb-0.5">From</p>
              <p className="font-semibold">{question.from_name || 'Team'}</p>
            </div>
            <div className="bg-surface-200/5 rounded-lg px-3 py-2">
              <p className="text-xs text-surface-200/30 mb-0.5">Category</p>
              <p className="font-semibold">{question.tag || 'General'}</p>
            </div>
            <div className="bg-surface-200/5 rounded-lg px-3 py-2">
              <p className="text-xs text-surface-200/30 mb-0.5">Submitted</p>
              <p className="font-semibold">{timeAgo(question.created_at)}</p>
            </div>
          </div>

          {patientName && (
            <div className="bg-brand-600/10 border border-brand-600/20 rounded-lg px-4 py-3">
              <p className="text-xs text-brand-400 mb-1 font-medium">Patient</p>
              <p className="text-base font-bold">{patientName}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-surface-200/30 mb-2 uppercase tracking-wider font-medium">Details</p>
            <div className="text-sm text-surface-200/80 leading-relaxed space-y-3">
              {mainQuestion.split('\n').filter(Boolean).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>

          {context && (
            <div className="bg-surface-200/5 rounded-lg px-4 py-3">
              <p className="text-xs text-surface-200/30 mb-2 uppercase tracking-wider font-medium">Background Context</p>
              <div className="text-sm text-surface-200/60 leading-relaxed space-y-2">
                {context.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}

          <AttachmentsBlock question={question} />

          <button onClick={() => onArchive(question.id)}
            className="w-full flex items-center justify-center gap-2 text-sm text-surface-200/40 hover:text-red-400 transition mt-2 py-2">
            <Archive size={14} /> Move to Archive
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Focus view: one question at a time, like the main dash ──
function SnoozePicker({ onSnooze, onClose }) {
  return (
    <div className="absolute bottom-full mb-2 right-0 bg-surface-800 border border-surface-200/20 rounded-xl shadow-xl shadow-black/30 p-2 z-10 animate-slide-up">
      <p className="text-[10px] text-surface-200/30 uppercase tracking-wider px-2 py-1">Snooze for...</p>
      <div className="flex gap-1">
        {SNOOZE_OPTIONS.map(opt => (
          <button
            key={opt.label}
            onClick={() => { onSnooze(opt.ms); onClose(); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface-200/10 text-surface-200/60 hover:bg-amber-500/20 hover:text-amber-400 transition whitespace-nowrap"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionFocusView({ questions, onArchive, loading }) {
  const [skipped, setSkipped] = useState(new Set());
  const [snoozed, setSnoozed] = useState(new Map());
  const [done, setDone] = useState(new Set());
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const sorted = [...questions].sort((a, b) => {
    const d = getUrgency(a).order - getUrgency(b).order;
    if (d !== 0) return d;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const active = sorted.filter(q => !skipped.has(q.id) && !snoozed.has(q.id) && !done.has(q.id));
  const current = active[0];
  const total = sorted.length;
  const handled = done.size + skipped.size;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader size={24} className="animate-spin text-brand-500" /></div>;
  }

  if (!current) {
    return (
      <div className="rounded-2xl border-2 border-good/20 bg-good/5 p-8 text-center">
        <CheckCircle2 size={48} className="mx-auto text-good mb-3" />
        <h2 className="text-xl font-bold mb-1">{total === 0 ? 'No pending requests!' : 'All requests handled!'}</h2>
        <p className="text-surface-200/50 text-sm">
          {total === 0 ? 'Your team has nothing waiting on you.' : `${handled} handled this session. Snoozed ones will come back.`}
        </p>
      </div>
    );
  }

  const u = getUrgency(current);
  const { patientName, mainQuestion, context } = parseQuestion(current);
  const position = total - active.length + 1;

  function handleArchive() {
    setDone(prev => new Set(prev).add(current.id));
    setShowDone(true);
    setTimeout(() => setShowDone(false), 600);
    onArchive(current.id);
  }

  function handleSkip() {
    setSkipped(prev => new Set(prev).add(current.id));
  }

  function handleSnooze(ms) {
    const id = current.id;
    setSnoozed(prev => new Map(prev).set(id, true));
    setTimeout(() => {
      setSnoozed(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }, ms);
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-surface-200/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-good rounded-full transition-all duration-500"
            style={{ width: `${(handled / Math.max(total, 1)) * 100}%` }}
          />
        </div>
        <span className="text-xs text-surface-200/40 font-mono whitespace-nowrap">{position}/{total}</span>
      </div>

      {/* Current question card */}
      <div className={`relative rounded-2xl border-2 ${u.border} bg-surface-800 overflow-hidden transition-all ${showDone ? 'scale-95 opacity-50' : 'scale-100'} ${u.glow}`}>
        <div className={`${u.bg} px-6 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${u.dot} animate-pulse`} />
            <span className={`text-sm font-black uppercase tracking-wider ${u.text}`}>{u.label}</span>
          </div>
          <span className="text-xs text-surface-200/40 flex items-center gap-1"><Clock size={10} /> {timeAgo(current.created_at)}</span>
        </div>

        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold leading-tight">
            {current.headline || mainQuestion?.slice(0, 80)}
          </h2>

          <div className="flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1.5 bg-surface-200/5 rounded-lg px-3 py-1.5"><User size={12} /> {current.from_name || 'Team'}</span>
            <span className="flex items-center gap-1.5 bg-surface-200/5 rounded-lg px-3 py-1.5"><Tag size={12} /> {current.tag || 'General'}</span>
            {patientName && (
              <span className="flex items-center gap-1.5 bg-brand-600/10 border border-brand-600/20 text-brand-400 rounded-lg px-3 py-1.5 font-semibold">{patientName}</span>
            )}
          </div>

          <div className="text-sm text-surface-200/80 leading-relaxed space-y-2">
            {mainQuestion.split('\n').filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          {context && (
            <div className="bg-surface-200/5 rounded-lg px-4 py-3">
              <p className="text-xs text-surface-200/30 mb-1.5 uppercase tracking-wider font-medium">Background Context</p>
              <div className="text-sm text-surface-200/60 leading-relaxed space-y-1.5">
                {context.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}

          <AttachmentsBlock question={current} />

          {/* Actions — same pattern as dash focus view */}
          <div className="flex items-stretch gap-2 pt-2">
            <button
              onClick={handleArchive}
              className="flex-1 bg-good/20 text-good hover:bg-good/30 font-medium px-4 py-3 rounded-xl transition flex items-center justify-center gap-2"
              title="Handled — move to archive"
            >
              <CheckCircle2 size={16} /> Done
            </button>

            <div className="relative flex flex-col items-center gap-1">
              {showSnoozePicker && (
                <SnoozePicker onSnooze={handleSnooze} onClose={() => setShowSnoozePicker(false)} />
              )}
              <button
                onClick={() => setShowSnoozePicker(prev => !prev)}
                className="px-4 py-2.5 bg-surface-200/10 text-surface-200/50 rounded-xl hover:bg-amber-500/20 hover:text-amber-400 transition"
                title="Snooze"
              >
                <AlarmClock size={18} />
              </button>
              <span className="text-[9px] text-surface-200/30">Snooze</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleSkip}
                className="px-4 py-2.5 bg-surface-200/10 text-surface-200/50 rounded-xl hover:bg-surface-200/15 hover:text-surface-200/70 transition"
                title="Skip this for now"
              >
                <SkipForward size={18} />
              </button>
              <span className="text-[9px] text-surface-200/30">Skip</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming peek */}
      {active.length > 1 && (
        <div className="opacity-40 pointer-events-none">
          <div className={`rounded-2xl border ${getUrgency(active[1]).border} bg-surface-800 p-4`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${getUrgency(active[1]).dot}`} />
              <span className="text-xs font-medium text-surface-200/40">Up next</span>
              <span className="text-sm text-surface-200/50 truncate">
                {active[1].headline || active[1].question?.split('\n')[0]?.slice(0, 60)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QAView() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [sortBy, setSortBy] = useState('urgency');
  const [focused, setFocused] = useState(null);
  const [viewMode, setViewMode] = useState('focus'); // always opens in focus

  async function loadQuestions(f = filter) {
    setLoading(true);
    try {
      const data = await api.questions(f);
      setQuestions(data.questions || data || []);
    } catch (e) {
      console.error('QA load error:', e);
    }
    setLoading(false);
  }

  useEffect(() => { loadQuestions(); }, [filter]);

  const sorted = [...questions].sort((a, b) => {
    if (sortBy === 'urgency') return getUrgency(a).order - getUrgency(b).order;
    if (sortBy === 'person') return (a.from_name || '').localeCompare(b.from_name || '');
    if (sortBy === 'category') return (a.tag || '').localeCompare(b.tag || '');
    if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    return 0;
  });

  const pendingQuestions = filter === 'pending' ? questions : questions.filter(q => q.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Team Requests</h1>
        <div className="flex items-center gap-3">
          {/* Focus / All toggle — same pattern as dash */}
          <div className="flex bg-surface-200/10 rounded-lg p-0.5">
            <button
              onClick={() => { setViewMode('focus'); setFilter('pending'); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                viewMode === 'focus' ? 'bg-brand-600 text-white' : 'text-surface-200/50 hover:text-white'
              }`}
              title="One request at a time"
            >
              <Zap size={12} /> Focus
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                viewMode === 'all' ? 'bg-brand-600 text-white' : 'text-surface-200/50 hover:text-white'
              }`}
              title="All requests"
            >
              <LayoutList size={12} /> All
            </button>
          </div>
          <button onClick={() => loadQuestions()} className="text-surface-200/40 hover:text-white">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {viewMode === 'focus' ? (
        <QuestionFocusView
          questions={pendingQuestions}
          loading={loading && filter === 'pending'}
          onArchive={async (id) => {
            await api.archiveQuestion(id);
            setQuestions(prev => prev.filter(q => q.id !== id));
          }}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              {['pending', 'answered', 'archived', 'all'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full transition capitalize ${filter === f ? 'bg-brand-600 text-white' : 'bg-surface-200/10 text-surface-200/60 hover:text-white'}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-surface-200/40">
              <ArrowUpDown size={12} />
              {['urgency', 'person', 'category', 'newest'].map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-2 py-1 rounded transition capitalize ${sortBy === s ? 'bg-surface-200/10 text-white' : 'hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="flex justify-center py-12"><Loader size={24} className="animate-spin text-brand-500" /></div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-focus-group>
            {sorted.map((q, i) => (
              <QuestionCard key={q.id || i} q={q} onClick={setFocused}
                onRestore={async (id) => { await api.restoreQuestion(id); loadQuestions(); }} />
            ))}
          </div>

          {!loading && sorted.length === 0 && (
            <div className="text-center py-12">
              <p className="text-surface-200/30 text-lg">No {filter} requests</p>
            </div>
          )}
        </>
      )}

      {focused && (
        <FocusModal
          question={focused}
          onClose={() => setFocused(null)}
          onArchive={async (id) => {
            await api.archiveQuestion(id);
            setFocused(null);
            loadQuestions();
          }}
        />
      )}
    </div>
  );
}
