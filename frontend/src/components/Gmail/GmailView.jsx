import React, { useState } from 'react';
import { Mail, Star, Clock, Bot, ChevronRight } from 'lucide-react';

const MOCK_THREADS = [
  { id: 1, from: 'Supplier Co', subject: 'Invoice #4021 — CPAP supplies order', snippet: 'Please find attached the invoice for your recent order...', time: '9:23 AM', unread: true, priority: 'warn' },
  { id: 2, from: 'Sarah (Admin)', subject: 'Re: Insurance verification question', snippet: 'Hey Corey, wanted to follow up on the Blue Cross process...', time: '8:45 AM', unread: true, priority: 'normal' },
  { id: 3, from: 'Dr. Reynolds Office', subject: 'Patient referral — BIPAP', snippet: 'We have a new patient who needs a BIPAP setup...', time: 'Yesterday', unread: false, priority: 'urgent' },
  { id: 4, from: 'Mike (Warehouse)', subject: 'Shipping update', snippet: 'The wheelchair order is delayed by 2 days due to...', time: 'Yesterday', unread: false, priority: 'normal' },
];

function ThreadRow({ thread, onSummarize }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3 border-b border-surface-200/5 hover:bg-surface-800/50 cursor-pointer ${thread.unread ? 'bg-surface-800/30' : ''}`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${thread.unread ? 'bg-brand-500' : 'bg-transparent'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${thread.unread ? 'font-semibold' : 'font-medium text-surface-200/80'}`}>{thread.from}</span>
          {thread.priority === 'urgent' && <span className="badge-urgent">urgent</span>}
          {thread.priority === 'warn' && <span className="badge-warn">action needed</span>}
        </div>
        <p className="text-sm text-surface-200/60 truncate">{thread.subject}</p>
        <p className="text-xs text-surface-200/40 truncate mt-0.5">{thread.snippet}</p>
      </div>
      <span className="text-xs text-surface-200/40 flex-shrink-0">{thread.time}</span>
      <button onClick={(e) => { e.stopPropagation(); onSummarize(thread.id); }} className="text-brand-500 hover:text-brand-400 flex-shrink-0" title="AI Summarize">
        <Bot size={16} />
      </button>
      <ChevronRight size={16} className="text-surface-200/20" />
    </div>
  );
}

export default function GmailView() {
  const [summary, setSummary] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Mail size={22} /> Gmail</h1>
        <button className="btn-primary text-sm">Summarize all unread</button>
      </div>

      <div className="card p-0 overflow-hidden">
        {MOCK_THREADS.map((t) => (
          <ThreadRow key={t.id} thread={t} onSummarize={(id) => setSummary(`AI summary for thread ${id} would appear here`)} />
        ))}
      </div>

      {summary && (
        <div className="card border-brand-600/30">
          <div className="card-header flex items-center gap-2">
            <Bot size={16} className="text-brand-500" /> Claude Summary
          </div>
          <p className="text-sm text-surface-200/80">{summary}</p>
        </div>
      )}
    </div>
  );
}
