import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader, X, User, Tag, ArrowUpDown, Archive, RotateCcw, Paperclip, Download, FileText } from 'lucide-react';
import { api } from '../../services/api';

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

function timeAgo(dateStr) {
  if (!dateStr) return '';
  // SQLite stores UTC without a timezone marker — parse it as UTC, not local
  const utc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)
    ? new Date(dateStr.replace(' ', 'T') + 'Z')
    : new Date(dateStr);
  const diff = Date.now() - utc.getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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

function FocusModal({ question, onClose, onArchive }) {
  const u = getUrgency(question);
  const [attachments, setAttachments] = useState(question.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

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



  const qText = question.question || '';
  const patientMatch = qText.match(/^\[Patient: ([^\]]+)\]\s*/);
  const patientName = patientMatch ? patientMatch[1] : null;
  const afterPatient = patientMatch ? qText.slice(patientMatch[0].length) : qText;
  const contextSplit = afterPatient.split('\n\nContext: ');
  const mainQuestion = contextSplit[0];
  const context = contextSplit[1] || null;

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

        <div className="p-6 space-y-5">
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


          {/* Attachments */}
          <div>
            <p className="text-xs text-surface-200/30 mb-2 uppercase tracking-wider font-medium flex items-center gap-1">
              <Paperclip size={11} /> Attachments {attachments.length > 0 && `(${attachments.length})`}
            </p>
            {attachments.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {attachments.map(att => (
                  <div key={att.id} className="group flex items-center gap-2 bg-surface-200/5 hover:bg-surface-200/10 rounded-lg px-3 py-2 text-sm transition">
                    <FileText size={14} className="text-brand-400 shrink-0" />
                    <a
                      href={api.qaAttachmentUrl(att.id)}
                      target="_blank" rel="noreferrer"
                      className="flex-1 truncate text-surface-200/80 hover:text-white hover:underline"
                      title={`Download ${att.original_name}`}
                    >
                      {att.original_name}
                    </a>
                    <span className="text-xs text-surface-200/30">{fmtSize(att.size)}</span>
                    {att.uploaded_by === 'corey' && <span className="text-[10px] text-surface-200/25">you</span>}
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
          </div>

          {/* Archive */}
          <button onClick={() => onArchive(question.id)}
            className="w-full flex items-center justify-center gap-2 text-sm text-surface-200/40 hover:text-red-400 transition mt-2 py-2">
            <Archive size={14} /> Move to Archive
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QAView() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [sortBy, setSortBy] = useState('urgency');
  const [focused, setFocused] = useState(null);


  async function loadQuestions() {
    setLoading(true);
    try {
      const data = await api.questions(filter);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Team Requests</h1>
        <button onClick={loadQuestions} className="text-surface-200/40 hover:text-white">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

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
