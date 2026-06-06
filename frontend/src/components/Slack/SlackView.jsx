import React, { useState, useEffect } from 'react';
import { Hash, Search, RefreshCw, Loader, MessageSquare, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';

function timeAgo(ts) {
  if (!ts) return '';
  const date = typeof ts === 'number' || /^\d+\.\d+$/.test(ts) ? new Date(parseFloat(ts) * 1000) : new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SlackView() {
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [dms, setDms] = useState([]);
  const [view, setView] = useState('channels'); // channels | dms

  async function loadChannels() {
    setLoading(true);
    try {
      const data = await api.slackChannels();
      setChannels(data.channels || data || []);
      // Also load DMs
      try {
        const dmData = await api.slackDMs();
        setDms(dmData.messages || dmData.dms || dmData || []);
      } catch (e) {}
    } catch (e) {
      console.error('Slack load error:', e);
    }
    setLoading(false);
  }

  async function selectChannel(ch) {
    setSelected(ch);
    setMessages([]);
    setSummary(null);
    setMsgsLoading(true);
    try {
      const data = await api.slackMessages(ch.id);
      setMessages(data.messages || data || []);
    } catch (e) {}
    setMsgsLoading(false);
  }

  async function summarizeChannel() {
    if (!selected) return;
    setSummaryLoading(true);
    try {
      const data = await api.slackSummarize(selected.id);
      setSummary(data.summary || data.response || JSON.stringify(data));
    } catch (e) {
      setSummary('Could not generate summary.');
    }
    setSummaryLoading(false);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQ.trim()) { setSearchResults(null); return; }
    setMsgsLoading(true);
    try {
      const data = await api.slackSearch(searchQ);
      setSearchResults(data.messages?.matches || data.messages || data || []);
    } catch (e) {
      setSearchResults([]);
    }
    setMsgsLoading(false);
  }

  useEffect(() => { loadChannels(); }, []);

  const channelList = view === 'channels' ? channels : dms;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare size={20} /> Slack
        </h1>
        <button onClick={loadChannels} className="text-surface-200/40 hover:text-white">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setView('channels')} className={`text-xs px-3 py-1.5 rounded-full transition ${view === 'channels' ? 'bg-brand-600 text-white' : 'bg-surface-200/10 text-surface-200/60'}`}>
          Channels ({channels.length})
        </button>
        <button onClick={() => setView('dms')} className={`text-xs px-3 py-1.5 rounded-full transition ${view === 'dms' ? 'bg-brand-600 text-white' : 'bg-surface-200/10 text-surface-200/60'}`}>
          DMs ({dms.length})
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-200/40" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search Slack..." className="input pl-9 w-full" />
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 card max-h-[70vh] overflow-y-auto p-0" data-focus-group>
          {loading && <div className="p-4 flex justify-center"><Loader size={18} className="animate-spin text-brand-500" /></div>}
          {channelList.map((ch, i) => (
            <div
              key={ch.id || i}
              data-focus-item="" onClick={() => selectChannel(ch)}
              className={`flex items-center justify-between p-3 cursor-pointer border-b border-surface-200/5 hover:bg-surface-200/5 transition ${selected?.id === ch.id ? 'bg-brand-600/10 border-l-2 border-l-brand-500' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Hash size={14} className="text-surface-200/40 shrink-0" />
                <span className="text-sm truncate">{ch.name || ch.user || 'Unknown'}</span>
              </div>
              {ch.num_members && <span className="text-xs text-surface-200/30">{ch.num_members}</span>}
              <ChevronRight size={14} className="text-surface-200/20 shrink-0" />
            </div>
          ))}
        </div>

        <div className="lg:col-span-3 card max-h-[70vh] overflow-y-auto">
          {!selected && !searchResults ? (
            <p className="text-surface-200/40 text-sm py-8 text-center">Select a channel to view messages</p>
          ) : (
            <div className="space-y-3">
              {selected && (
                <div className="flex items-center justify-between pb-3 border-b border-surface-200/10">
                  <h2 className="font-semibold text-sm">#{selected.name || selected.user}</h2>
                  <button onClick={summarizeChannel} disabled={summaryLoading} className="btn-secondary text-xs flex items-center gap-1">
                    {summaryLoading ? <Loader size={12} className="animate-spin" /> : '✨'}
                    Summarize
                  </button>
                </div>
              )}

              {summary && (
                <div className="bg-brand-600/10 border border-brand-600/20 rounded-lg p-3">
                  <p className="text-sm text-surface-200/80 whitespace-pre-wrap">{summary}</p>
                </div>
              )}

              {msgsLoading && <div className="flex justify-center py-4"><Loader size={18} className="animate-spin text-brand-500" /></div>}

              {(searchResults || messages).map((msg, i) => (
                <div key={i} className="pb-3 border-b border-surface-200/5 last:border-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-medium">{msg.user_name || msg.user || 'Unknown'}</span>
                    <span className="text-xs text-surface-200/30">{timeAgo(msg.ts)}</span>
                  </div>
                  <p className="text-sm text-surface-200/70 whitespace-pre-wrap">{msg.text}</p>
                  {msg.reply_count > 0 && (
                    <p className="text-xs text-brand-500 mt-1">{msg.reply_count} replies</p>
                  )}
                </div>
              ))}

              {!msgsLoading && (searchResults || messages).length === 0 && (
                <p className="text-sm text-surface-200/40 py-4 text-center">No messages found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
