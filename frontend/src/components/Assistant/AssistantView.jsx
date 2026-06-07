import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import ElenaLogo from '../shared/ElenaLogo';

export default function AssistantView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const historyData = await api.chatHistory();
        const history = historyData.messages || historyData || [];
        if (Array.isArray(history) && history.length > 0) {
          setMessages(history.map(h => ({
            role: h.role,
            content: h.content || h.message || h.response,
            time: h.timestamp || h.created_at,
          })));
        }
      } catch (e) {}
      setHistoryLoaded(true);
    }
    loadHistory();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg, time: new Date().toISOString() }]);
    setLoading(true);

    try {
      const data = await api.chat(msg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || data.message || 'No response.',
        time: new Date().toISOString(),
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't connect right now. Try again in a moment.",
        time: new Date().toISOString(),
      }]);
    }
    setLoading(false);
  }

  const suggestions = [
    "What's the most urgent thing I should handle right now?",
    "Summarize my recent Slack activity",
    "Who has been trying to reach me?",
    "What's the status of our current authorizations?",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 pb-4 border-b border-surface-200/10">
        <div className="w-10 h-10 rounded-full bg-[#1a2e2d] flex items-center justify-center p-1.5">
          <ElenaLogo size={28} />
        </div>
        <div>
          <h1 className="text-lg font-bold">Elena</h1>
          <p className="text-xs text-surface-200/40">Your AI executive assistant — knows your team, your patterns, your business</p>
        </div>
        <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Online
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && historyLoaded && (
          <div className="text-center py-12 space-y-6">
            <div className="w-16 h-16 rounded-full bg-brand-600/20 flex items-center justify-center mx-auto">
              <Sparkles size={28} className="text-brand-500" />
            </div>
            <div>
              <p className="text-surface-200/60 text-sm">Hi Corey! I'm Elena, your personal assistant.</p>
              <p className="text-surface-200/40 text-xs mt-1">I know your team, your communications, and your business. Ask me anything.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(s); }}
                  className="text-xs bg-surface-200/5 hover:bg-surface-200/10 border border-surface-200/10 rounded-full px-3 py-1.5 text-surface-200/60 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-brand-600/20 border border-brand-600/30'
                : 'bg-surface-200/5 border border-surface-200/10'
            }`}>
              {msg.role === 'assistant' && (
                <p className="text-xs text-brand-500 font-medium mb-1 flex items-center gap-1">
                  <ElenaLogo size={12} /> Elena
                </p>
              )}
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-200/5 border border-surface-200/10 rounded-lg px-4 py-3 flex items-center gap-2">
              <Loader size={14} className="animate-spin text-brand-500" />
              <span className="text-sm text-surface-200/40">Elena is thinking...</span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 pt-4 border-t border-surface-200/10">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask Elena anything..."
          className="input flex-1"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
