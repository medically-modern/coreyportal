import React, { useState, useEffect } from 'react';
import { LayoutGrid, RefreshCw, Loader, AlertTriangle, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

const STATUS_ICONS = {
  'Done': <CheckCircle2 size={14} className="text-green-400" />,
  'Working on it': <Clock size={14} className="text-yellow-400" />,
  'Stuck': <AlertCircle size={14} className="text-red-400" />,
};

export default function MondayView() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(null);

  async function loadBoards() {
    setLoading(true);
    try {
      const data = await api.mondayBoards();
      setBoards(data.boards || data || []);
      setConnected(true);
    } catch (e) {
      setConnected(false);
    }
    setLoading(false);
  }

  useEffect(() => { loadBoards(); }, []);

  if (connected === false) {
    return (
      <div className="card text-center py-12 space-y-4">
        <AlertTriangle size={40} className="mx-auto text-yellow-500" />
        <h2 className="text-lg font-semibold">Monday.com Not Connected</h2>
        <p className="text-surface-200/60 text-sm">Monday.com API key needs to be configured on the backend.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <LayoutGrid size={20} /> Monday.com
        </h1>
        <button onClick={loadBoards} className="text-surface-200/40 hover:text-white">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader size={24} className="animate-spin text-brand-500" />
        </div>
      )}

      {boards.map((board, bi) => (
        <div key={bi} className="card">
          <h2 className="card-header">{board.name || `Board ${bi + 1}`}</h2>
          <div className="divide-y divide-surface-200/5">
            {(board.items || board.items_page?.items || []).map((item, ii) => {
              const status = item.column_values?.find(c => c.title === 'Status' || c.id === 'status')?.text || '';
              const person = item.column_values?.find(c => c.title === 'Person' || c.id === 'person')?.text || '';
              const date = item.column_values?.find(c => c.title === 'Date' || c.id === 'date')?.text || '';
              return (
                <div key={ii} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {STATUS_ICONS[status] || <Clock size={14} className="text-surface-200/30" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {person && <p className="text-xs text-surface-200/40">{person}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        status === 'Done' ? 'bg-green-500/20 text-green-400' :
                        status === 'Stuck' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>{status}</span>
                    )}
                    {date && <span className="text-xs text-surface-200/30">{date}</span>}
                  </div>
                </div>
              );
            })}
            {(board.items || board.items_page?.items || []).length === 0 && (
              <p className="text-sm text-surface-200/40 py-3">No items.</p>
            )}
          </div>
        </div>
      ))}

      {!loading && boards.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-surface-200/40 text-sm">No boards found.</p>
        </div>
      )}
    </div>
  );
}
