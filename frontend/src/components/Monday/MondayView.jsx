import React from 'react';
import { Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

const MOCK_ITEMS = [
  { id: 1, board: 'Operations', name: 'DME compliance checklist', status: 'working', due: 'Friday', owner: 'Corey' },
  { id: 2, board: 'Sales', name: 'Follow up Baptist Health referral', status: 'stuck', due: 'Today', owner: 'Corey' },
  { id: 3, board: 'Admin', name: 'Review Q2 supply contracts', status: 'working', due: 'Next Monday', owner: 'Corey' },
  { id: 4, board: 'Operations', name: 'Warehouse inventory audit', status: 'done', due: 'Yesterday', owner: 'Lisa' },
];

const STATUS_MAP = {
  working: { color: 'text-brand-500 bg-brand-500/20', label: 'Working' },
  stuck: { color: 'text-urgent bg-urgent/20', label: 'Stuck' },
  done: { color: 'text-good bg-good/20', label: 'Done' },
};

export default function MondayView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Calendar size={22} /> Monday</h1>
        <p className="text-xs text-surface-200/40">Your tasks and deadlines</p>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200/10 text-xs text-surface-200/40 uppercase">
              <th className="text-left px-4 py-3">Task</th>
              <th className="text-left px-4 py-3">Board</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ITEMS.map((item) => {
              const s = STATUS_MAP[item.status];
              return (
                <tr key={item.id} className="border-b border-surface-200/5 hover:bg-surface-800/50">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-surface-200/60">{item.board}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span></td>
                  <td className="px-4 py-3 text-surface-200/60">{item.due}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
