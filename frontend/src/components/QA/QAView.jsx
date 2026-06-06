import React, { useState, useEffect } from 'react';
import { HelpCircle, RefreshCw, Loader, Send, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import { api } from '../../services/api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function QAView() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [answerText, setAnswerText] = useState({});
  const [answering, setAnswering] = useState(null);
  const [submitForm, setSubmitForm] = useState(false);
  const [newQ, setNewQ] = useState({ from: '', question: '', category: 'general' });
  const [submitting, setSubmitting] = useState(false);

  async function loadQuestions() {
    setLoading(true);
    try {
      const data = await api.questions(filter);
      setQuestions(data || []);
    } catch (e) {
      console.error('QA load error:', e);
    }
    setLoading(false);
  }

  async function handleAnswer(id) {
    const answer = answerText[id];
    if (!answer?.trim()) return;
    setAnswering(id);
    try {
      await api.answerQuestion(id, answer);
      setAnswerText(prev => ({ ...prev, [id]: '' }));
      loadQuestions();
    } catch (e) {}
    setAnswering(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newQ.question.trim()) return;
    setSubmitting(true);
    try {
      await api.submitQuestion(newQ);
      setNewQ({ from: '', question: '', category: 'general' });
      setSubmitForm(false);
      setFilter('pending');
      loadQuestions();
    } catch (e) {}
    setSubmitting(false);
  }

  useEffect(() => { loadQuestions(); }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <HelpCircle size={20} /> Q&A Board
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setSubmitForm(!submitForm)} className="btn-primary text-xs">
            + Ask Question
          </button>
          <button onClick={loadQuestions} className="text-surface-200/40 hover:text-white">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {submitForm && (
        <form onSubmit={handleSubmit} className="card space-y-3">
          <h3 className="text-sm font-semibold">Submit a Question for Corey</h3>
          <input
            value={newQ.from}
            onChange={e => setNewQ(p => ({ ...p, from: e.target.value }))}
            placeholder="Your name"
            className="input w-full"
          />
          <textarea
            value={newQ.question}
            onChange={e => setNewQ(p => ({ ...p, question: e.target.value }))}
            placeholder="What's your question?"
            className="input w-full h-20 resize-none"
          />
          <select
            value={newQ.category}
            onChange={e => setNewQ(p => ({ ...p, category: e.target.value }))}
            className="input w-full"
          >
            <option value="general">General</option>
            <option value="pipeline">Pipeline</option>
            <option value="technology">Technology</option>
            <option value="admin">Admin</option>
            <option value="urgent">Urgent</option>
          </select>
          <button type="submit" disabled={submitting} className="btn-primary text-sm">
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      )}

      <div className="flex gap-2">
        {['pending', 'answered', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-full transition capitalize ${filter === f ? 'bg-brand-600 text-white' : 'bg-surface-200/10 text-surface-200/60'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-8"><Loader size={24} className="animate-spin text-brand-500" /></div>}

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id || i} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {q.status === 'answered' ? (
                    <CheckCircle2 size={14} className="text-green-400" />
                  ) : (
                    <Clock size={14} className="text-yellow-400" />
                  )}
                  <span className="text-xs text-surface-200/40">{q.from || 'Team member'} · {timeAgo(q.created_at)}</span>
                  {q.category && (
                    <span className="text-xs bg-surface-200/10 px-2 py-0.5 rounded-full text-surface-200/50">{q.category}</span>
                  )}
                </div>
                <p className="text-sm font-medium">{q.question}</p>
              </div>
            </div>

            {q.answer && (
              <div className="mt-3 pl-4 border-l-2 border-brand-500/30">
                <p className="text-xs text-brand-500 mb-1">Corey's Answer</p>
                <p className="text-sm text-surface-200/70">{q.answer}</p>
              </div>
            )}

            {q.status !== 'answered' && (
              <div className="mt-3 flex gap-2">
                <input
                  value={answerText[q.id] || ''}
                  onChange={e => setAnswerText(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Type your answer..."
                  className="input flex-1 text-sm"
                />
                <button onClick={() => handleAnswer(q.id)} disabled={answering === q.id} className="btn-primary px-3">
                  {answering === q.id ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            )}
          </div>
        ))}

        {!loading && questions.length === 0 && (
          <div className="card text-center py-8">
            <MessageSquare size={32} className="mx-auto text-surface-200/20 mb-2" />
            <p className="text-sm text-surface-200/40">No {filter} questions right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
