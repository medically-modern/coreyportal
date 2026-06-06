import React, { useState } from 'react';
import { HelpCircle, Tag, Clock, CheckCircle, Bot, Filter } from 'lucide-react';

const TAGS = ['Pipeline', 'Technology', 'Admin', 'Former Seller', 'HR', 'Compliance', 'Other'];
const STATUSES = ['pending', 'in_progress', 'answered'];

const MOCK_QUESTIONS = [
  { id: 1, from: 'Sarah M.', tag: 'Admin', question: 'What\'s the process for verifying Blue Cross insurance for new patients?', time: '1 hr ago', status: 'pending', priority: 'normal' },
  { id: 2, from: 'Mike T.', tag: 'Pipeline', question: 'The wheelchair supplier said lead times are now 3 weeks — should we switch vendors?', time: '2 hrs ago', status: 'pending', priority: 'urgent' },
  { id: 3, from: 'Lisa R.', tag: 'Technology', question: 'How do I reset the barcode scanner in the warehouse?', time: '3 hrs ago', status: 'pending', priority: 'normal' },
  { id: 4, from: 'James K.', tag: 'Former Seller', question: 'Can I get a copy of my W-2 from last year?', time: 'Yesterday', status: 'pending', priority: 'normal' },
];

function QuestionCard({ q, onAiDraft }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium bg-brand-600/20 text-brand-400 px-2 py-0.5 rounded-full">{q.tag}</span>
            {q.priority === 'urgent' && <span className="badge-urgent">urgent</span>}
            <span className="text-xs text-surface-200/40">{q.time}</span>
          </div>
          <p className="text-sm font-medium">{q.question}</p>
          <p className="text-xs text-surface-200/40 mt-1">From: {q.from}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => onAiDraft(q)} className="text-xs text-brand-500 hover:text-brand-400 flex items-center gap-1">
            <Bot size={14} /> AI Draft
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-surface-200/5">
        <textarea placeholder="Type your answer..." className="w-full bg-surface-900/50 rounded-lg p-3 text-sm text-white placeholder-surface-200/30 outline-none resize-none h-20" />
        <div className="flex justify-end mt-2 gap-2">
          <button className="text-xs text-surface-200/40 hover:text-white px-3 py-1.5 rounded-lg">Skip</button>
          <button className="btn-primary text-xs">Send Answer</button>
        </div>
      </div>
    </div>
  );
}

export default function QAView() {
  const [filter, setFilter] = useState('pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><HelpCircle size={22} /> Questions for Corey</h1>
        <div className="flex items-center gap-2">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${filter === s ? 'bg-brand-600 text-white' : 'bg-surface-800 text-surface-200/60 hover:text-white'}`}>
              {s === 'pending' ? `Pending (${MOCK_QUESTIONS.length})` : s === 'in_progress' ? 'In Progress' : 'Answered'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {MOCK_QUESTIONS.map((q) => (
          <QuestionCard key={q.id} q={q} onAiDraft={(q) => console.log('AI draft for', q.id)} />
        ))}
      </div>
    </div>
  );
}
