import React from 'react';
import { MessageSquare, Hash, Bot } from 'lucide-react';

const MOCK_MENTIONS = [
  { id: 1, channel: '#general', from: 'Sarah', message: '@corey can you approve the PTO request for next week?', time: '45 min ago' },
  { id: 2, channel: '#sales', from: 'James', message: '@corey the new lead from Baptist Health wants a call — when are you free?', time: '2 hrs ago' },
  { id: 3, channel: '#operations', from: 'Lisa', message: '@corey warehouse scanner is down again, same issue as last month', time: '3 hrs ago' },
];

export default function SlackView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><MessageSquare size={22} /> Slack</h1>
        <p className="text-xs text-surface-200/40">Mentions & DMs requiring your attention</p>
      </div>

      <div className="card border-warn/30">
        <p className="text-sm text-warn">
          <strong>Tip:</strong> Questions from the team are being routed to the Questions tab. 
          This view shows only direct Slack mentions that need Corey's personal response.
        </p>
      </div>

      <div className="space-y-3">
        {MOCK_MENTIONS.map((m) => (
          <div key={m.id} className="card">
            <div className="flex items-center gap-2 mb-2">
              <Hash size={14} className="text-surface-200/40" />
              <span className="text-xs text-surface-200/40">{m.channel}</span>
              <span className="text-xs text-surface-200/40">· {m.time}</span>
            </div>
            <p className="text-sm"><strong>{m.from}:</strong> {m.message}</p>
            <div className="flex gap-2 mt-3">
              <button className="text-xs text-brand-500 hover:text-brand-400 flex items-center gap-1"><Bot size={14} /> AI Draft Reply</button>
              <button className="text-xs text-surface-200/40 hover:text-white">Open in Slack</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
