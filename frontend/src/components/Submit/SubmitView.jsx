import React, { useState } from 'react';
import { Send, CheckCircle2, AlertTriangle, Loader, Paperclip, X, FileText } from 'lucide-react';
import { api } from '../../services/api';

const URGENCY_LEVELS = [
  { value: 'very_low', label: 'Very Low', desc: 'No rush — whenever Corey gets a chance', color: 'bg-slate-400', ring: 'ring-slate-400/30' },
  { value: 'low', label: 'Low', desc: 'Not urgent, but would be nice this week', color: 'bg-blue-400', ring: 'ring-blue-400/30' },
  { value: 'medium', label: 'Medium', desc: 'Needs attention in the next day or two', color: 'bg-amber-400', ring: 'ring-amber-400/30' },
  { value: 'high', label: 'High', desc: 'Important — should be handled today', color: 'bg-orange-500', ring: 'ring-orange-500/30' },
  { value: 'super_high', label: 'Super High', desc: 'Critical — blocking work or a patient', color: 'bg-red-500', ring: 'ring-red-500/30' },
  { value: 'emergency', label: 'Emergency', desc: 'Drop everything — compliance, patient safety, or major issue', color: 'bg-red-700', ring: 'ring-red-700/30' },
];

const CATEGORIES = [
  { value: 'pipeline', label: 'Pipeline / Patient Status', desc: 'Auth status, shipping, patient follow-ups, order tracking' },
  { value: 'insurance', label: 'Insurance & Benefits', desc: 'Auth submissions, denials, same-or-similar, coverage questions' },
  { value: 'technology', label: 'Technology / Systems', desc: 'Monday.com, Parachute, ePaces, CareCarentrix, system bugs' },
  { value: 'admin', label: 'Admin / Operations', desc: 'Scheduling, processes, training, team coordination' },
  { value: 'compliance', label: 'Compliance / Legal', desc: 'HIPAA, Medicare rules, documentation requirements' },
  { value: 'patient_escalation', label: 'Patient Escalation', desc: 'Patient complaints, urgent supply needs, out-of-stock' },
  { value: 'sales', label: 'Sales / Leads', desc: 'New leads, sell calls, referrals, partnerships' },
  { value: 'other', label: 'Other', desc: "Anything that doesn't fit above" },
];

export default function SubmitView() {
  const [form, setForm] = useState({
    from: '',
    question: '',
    category: '',
    urgency: 'medium',
    headline: '',
    context: '',
    patient_name: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);

  function addFiles(list) {
    const next = [...files, ...list].slice(0, 5);
    setFiles(next);
  }

  function fmtSize(b) {
    if (b > 1024 * 1024) return `${(b / 1048576).toFixed(1)} MB`;
    return `${Math.ceil(b / 1024)} KB`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.from.trim() || !form.headline.trim() || !form.question.trim() || !form.category) {
      setError('Please fill in your name, headline, details, and category.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.submitQuestion({
        from: form.from.trim(),
        headline: form.headline.trim(),
        question: form.question.trim(),
        category: form.category,
        urgency: form.urgency,
        context: form.context.trim(),
        patient_name: form.patient_name.trim(),
      });
      if (files.length > 0 && result?.id) {
        try {
          await api.qaUploadAttachments(result.id, files, 'employee');
        } catch (upErr) {
          console.error('Attachment upload failed:', upErr);
          setError('Your question was submitted, but the attachments failed to upload. You can reply to Corey with the files directly.');
        }
      }
      setSubmitted(true);
      setFiles([]);
      setForm({ from: '', question: '', category: '', urgency: 'medium', headline: '', context: '', patient_name: '' });
    } catch (e) {
      setError('Failed to submit. Please try again or message Corey directly.');
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-good/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-good" />
          </div>
          <h1 className="text-2xl font-bold">Submitted!</h1>
          <p className="text-surface-200/60">Corey will see this in his portal. Elena may also flag it if it's urgent.</p>
          <button onClick={() => setSubmitted(false)} className="btn-primary">
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-900">
      <div className="bg-surface-800 border-b border-surface-200/10">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center font-bold text-sm">MM</div>
            <div>
              <h1 className="text-xl font-bold">Medically Modern — Team Requests</h1>
              <p className="text-sm text-surface-200/50">Send a question or request to Corey</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Your Name <span className="text-urgent">*</span></label>
            <input
              value={form.from}
              onChange={e => setForm(p => ({ ...p, from: e.target.value }))}
              placeholder="e.g. Brandon, Janelle, Samantha..."
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">What is this about? <span className="text-urgent">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, category: cat.value }))}
                  className={`text-left rounded-xl p-3 border-2 transition-all ${
                    form.category === cat.value
                      ? 'border-brand-500 bg-brand-600/10'
                      : 'border-surface-200/10 hover:border-surface-200/20 bg-surface-800'
                  }`}
                >
                  <p className="text-sm font-medium">{cat.label}</p>
                  <p className="text-xs text-surface-200/40 mt-0.5">{cat.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">How urgent is this?</label>
            <div className="flex flex-wrap gap-2">
              {URGENCY_LEVELS.map(u => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, urgency: u.value }))}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 border-2 transition-all text-sm ${
                    form.urgency === u.value
                      ? `${u.ring} ring-2 border-transparent bg-surface-800`
                      : 'border-surface-200/10 bg-surface-800 hover:border-surface-200/20'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${u.color}`} />
                  {u.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-surface-200/30 mt-2">
              {URGENCY_LEVELS.find(u => u.value === form.urgency)?.desc}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Patient Name <span className="text-surface-200/30">(if applicable)</span></label>
            <input
              value={form.patient_name}
              onChange={e => setForm(p => ({ ...p, patient_name: e.target.value }))}
              placeholder="e.g. Gretchen Baker, Oscar Achuff..."
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Quick Summary <span className="text-urgent">*</span> <span className="text-surface-200/30">(15 words max)</span></label>
            <input
              value={form.headline}
              onChange={e => {
                const words = e.target.value.split(/\s+/).filter(Boolean);
                if (words.length <= 15) setForm(p => ({ ...p, headline: e.target.value }));
              }}
              placeholder="e.g. Patient denied auth, need Corey's call to provider"
              className="input w-full text-lg"
            />
            <p className="text-xs text-surface-200/20 mt-1">{form.headline.split(/\s+/).filter(Boolean).length}/15 words</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Full Details <span className="text-urgent">*</span></label>
            <textarea
              value={form.question}
              onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
              placeholder="Give the full details here. Include patient names, order numbers, insurance info, what you\'ve tried, and what you need Corey to do."
              className="input w-full h-32 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Additional Context <span className="text-surface-200/30">(optional)</span></label>
            <textarea
              value={form.context}
              onChange={e => setForm(p => ({ ...p, context: e.target.value }))}
              placeholder="Any background info, related tickets, etc."
              className="input w-full h-20 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Attachments <span className="text-surface-200/30">(optional — PDFs, documents, screenshots; up to 5 files, 15 MB each)</span>
            </label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-surface-200/15 hover:border-brand-500/40 rounded-xl px-4 py-5 cursor-pointer text-surface-200/40 hover:text-brand-400 transition"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addFiles([...e.dataTransfer.files]); }}
            >
              <Paperclip size={16} />
              <span className="text-sm">Click to attach files, or drag them here</span>
              <input
                type="file" multiple className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.heic,.gif"
                onChange={e => { addFiles([...e.target.files]); e.target.value = ''; }}
              />
            </label>
            {files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-surface-800 border border-surface-200/10 rounded-lg px-3 py-2 text-sm">
                    <FileText size={14} className="text-brand-400 shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-surface-200/30">{fmtSize(f.size)}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                      className="text-surface-200/30 hover:text-red-400 transition">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-urgent text-sm bg-urgent/10 rounded-lg px-4 py-3">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2">
            {submitting ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
            {submitting ? 'Submitting...' : 'Send to Corey'}
          </button>
        </form>
      </div>
    </div>
  );
}
