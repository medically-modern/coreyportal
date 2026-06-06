import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';

const INITIAL_MESSAGES = [
  {
    role: 'assistant',
    content: "Hey Corey — I'm your AI assistant. I can help you triage emails, draft responses, summarize text conversations, answer questions about your business, or just help you think through decisions. What do you need?",
  },
];

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-1">
          <Bot size={16} />
        </div>
      )}
      <div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser ? 'bg-brand-600 text-white' : 'bg-surface-800 text-surface-200/90'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Summarize my unread emails",
  "What's urgent today?",
  "Draft a reply to Dr. Reynolds",
  "Show me pending questions",
];

export default function AssistantView() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', content: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);

    // TODO: Replace with real API call
    setTimeout(() => {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: `I'll help with that. [This is a placeholder — the Claude API integration will power real responses here, with full context from your Gmail, RingCentral, Slack, and Q&A data.]`,
      }]);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2"><Bot size={22} /> AI Assistant</h1>
        <span className="badge-good">Online</span>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-1">
        {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        {loading && (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-surface-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-surface-200/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-surface-200/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-surface-200/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="text-xs bg-surface-800 hover:bg-surface-800/80 text-surface-200/60 hover:text-white px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
              <Sparkles size={12} /> {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-3 bg-surface-800 rounded-xl px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          placeholder="Ask Claude anything..."
          className="flex-1 bg-transparent text-sm text-white placeholder-surface-200/30 outline-none"
        />
        <button onClick={() => send(input)} disabled={!input.trim() || loading} className="text-brand-500 hover:text-brand-400 disabled:text-surface-200/20">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
