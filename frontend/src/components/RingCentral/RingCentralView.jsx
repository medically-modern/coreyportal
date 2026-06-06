import React, { useState, useEffect } from 'react';
import { Phone, RefreshCw, Loader, MessageSquare, Sparkles, ChevronRight, AlertTriangle } from 'lucide-react';
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

export default function RingCentralView() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  async function loadMessages() {
    setLoading(true);
    try {
      const status = await api.rcStatus();
      setConnected(status.connected !== false);
      const data = await api.rcMessages();
      setConversations(data.conversations || []);
    } catch (e) {
      setConnected(false);
    }
    setLoading(false);
  }

  async function summarizeConvo(contact) {
    setSummaryLoading(true);
    try {
      const data = await api.rcSummarize(contact);
      setSummary(data.summary || data.response || JSON.stringify(data));
    } catch (e) {
      setSummary('Could not generate summary.');
    }
    setSummaryLoading(false);
  }

  useEffect(() => { loadMessages(); }, []);

  if (connected === false) {
    return (
      <div className="card text-center py-12 space-y-4">
        <AlertTriangle size={40} className="mx-auto text-yellow-500" />
        <h2 className="text-lg font-semibold">RingCentral Not Connected</h2>
        <p className="text-surface-200/60 text-sm">RingCentral API credentials need to be configured on the backend.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Phone size={20} /> RingCentral
        </h1>
        <button onClick={loadMessages} className="text-surface-200/40 hover:text-white">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 card max-h-[70vh] overflow-y-auto p-0" data-focus-group>
          {loading && <div className="p-4 flex justify-center"><Loader size={18} className="animate-spin text-brand-500" /></div>}
          {conversations.length === 0 && !loading && (
            <p className="text-sm text-surface-200/40 p-4">No conversations found.</p>
          )}
          {conversations.map((convo, i) => {
            const lastMsg = (convo.messages || [])[0];
            const unread = (convo.messages || []).some(m => m.readStatus === 'Unread');
            return (
              <div
                key={i}
                data-focus-item="" onClick={() => { setSelected(convo); setSummary(null); }}
                className={`flex items-center justify-between p-3 cursor-pointer border-b border-surface-200/5 hover:bg-surface-200/5 transition ${selected?.contact === convo.contact ? 'bg-brand-600/10 border-l-2 border-l-brand-500' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {unread && <span className="w-2 h-2 bg-brand-500 rounded-full shrink-0" />}
                    <span className={`text-sm truncate ${unread ? 'font-semibold' : ''}`}>{convo.contact}</span>
                  </div>
                  {lastMsg && (
                    <p className="text-xs text-surface-200/40 truncate mt-0.5">
                      {lastMsg.direction === 'Outbound' ? 'You: ' : ''}{lastMsg.text || '(no text)'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-surface-200/30">{lastMsg ? timeAgo(lastMsg.time) : ''}</span>
                  <ChevronRight size={14} className="text-surface-200/20" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-3 card max-h-[70vh] overflow-y-auto">
          {!selected ? (
            <p className="text-surface-200/40 text-sm py-8 text-center">Select a conversation to view</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-surface-200/10">
                <h2 className="font-semibold">{selected.contact}</h2>
                <button onClick={() => summarizeConvo(selected.contact)} disabled={summaryLoading} className="btn-secondary text-xs flex items-center gap-1">
                  {summaryLoading ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Summarize
                </button>
              </div>

              {summary && (
                <div className="bg-brand-600/10 border border-brand-600/20 rounded-lg p-3">
                  <p className="text-sm text-surface-200/80 whitespace-pre-wrap">{summary}</p>
                </div>
              )}

              {[...(selected.messages || [])].reverse().map((msg, i) => (
                <div key={msg.id || i} className={`flex ${msg.direction === 'Outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${msg.direction === 'Outbound' ? 'bg-brand-600/20' : 'bg-surface-200/10'}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.text || '(no text)'}</p>
                    <p className="text-xs text-surface-200/30 mt-1">{timeAgo(msg.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
