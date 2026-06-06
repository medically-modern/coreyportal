import React, { useState, useEffect, useRef } from 'react';
import { Mail, Phone, MessageSquare, HelpCircle, Loader, Bot, RefreshCw, ChevronRight, AlertCircle, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = typeof dateStr === 'number' || /^\d+\.\d+$/.test(dateStr) ? new Date(parseFloat(dateStr) * 1000) : new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ChannelBucket({ icon: Icon, label, color, bgColor, count, items, loading, onDrilldown }) {
  return (
    <div className={`rounded-2xl border-2 ${bgColor} p-6 transition-all hover:scale-[1.01]`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${color} bg-opacity-20 flex items-center justify-center`}>
            <Icon size={24} className={color.replace('bg-', 'text-')} />
          </div>
          <div>
            <h3 className="text-lg font-bold">{label}</h3>
            <p className="text-sm text-surface-200/50">
              {loading ? 'Checking...' : `${count} need${count === 1 ? 's' : ''} attention`}
            </p>
          </div>
        </div>
        <div className={`text-3xl font-black ${count > 0 ? color.replace('bg-', 'text-') : 'text-surface-200/20'}`}>
          {loading ? <Loader size={24} className="animate-spin" /> : count}
        </div>
      </div>
      {items.length > 0 && (
        <div className="space-y-2 mt-3">
          {items.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-surface-200/70 bg-surface-900/30 rounded-lg px-3 py-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.urgent ? 'bg-urgent' : 'bg-surface-200/30'}`} />
              <span className="truncate flex-1">{item.text}</span>
              <span className="text-xs text-surface-200/30 shrink-0">{item.time}</span>
            </div>
          ))}
          {count > 3 && (
            <button onClick={onDrilldown} className="text-xs text-brand-500 hover:text-brand-400 flex items-center gap-1 pl-1">
              +{count - 3} more <ChevronRight size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PendingQuestions({ questions, loading }) {
  if (loading || questions.length === 0) return null;
  return (
    <div className="rounded-2xl border-2 border-purple-500/20 bg-purple-500/5 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <HelpCircle size={24} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold">Team Questions</h3>
          <p className="text-sm text-surface-200/50">{questions.length} waiting for your answer</p>
        </div>
        <div className="ml-auto text-3xl font-black text-purple-400">{questions.length}</div>
      </div>
      <div className="space-y-2">
        {questions.slice(0, 3).map((q, i) => (
          <div key={i} className="flex items-start gap-2 text-sm bg-surface-900/30 rounded-lg px-3 py-2">
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
              q.urgency === 'emergency' || q.urgency === 'super_high' ? 'bg-urgent/20 text-urgent' :
              q.urgency === 'high' ? 'bg-warn/20 text-warn' :
              'bg-surface-200/10 text-surface-200/40'
            }`}>{q.urgency || 'normal'}</span>
            <div className="min-w-0 flex-1">
              <p className="text-surface-200/70 truncate">{q.question}</p>
              <p className="text-xs text-surface-200/30 mt-0.5">{q.from || 'Team'} · {timeAgo(q.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [emailData, setEmailData] = useState({ count: 0, items: [] });
  const [slackData, setSlackData] = useState({ count: 0, items: [] });
  const [rcData, setRcData] = useState({ count: 0, items: [] });
  const [questions, setQuestions] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState({ email: true, slack: true, rc: true, qa: true });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  async function loadAllChannels() {
    setLoading(true);
    setChannelsLoading({ email: true, slack: true, rc: true, qa: true });

    // Load all channels in parallel
    const emailPromise = (async () => {
      try {
        const status = await api.gmailStatus();
        if (status.connected) {
          const threads = await api.gmailThreads();
          const threadList = threads.threads || threads || [];
          const unread = threadList.filter(t => t.isUnread || t.unread);
          setEmailData({
            count: unread.length,
            items: threadList.filter(t => t.isUnread || t.unread).slice(0, 5).map(t => ({
              text: `${t.from?.split('<')[0]?.trim() || 'Unknown'}: ${t.subject}`,
              time: timeAgo(t.date),
              urgent: t.unread,
            })),
          });
        } else {
          setEmailData({ count: 0, items: [{ text: 'Gmail not connected yet', time: '', urgent: false }] });
        }
      } catch (e) {
        setEmailData({ count: 0, items: [] });
      }
      setChannelsLoading(p => ({ ...p, email: false }));
    })();

    const slackPromise = (async () => {
      try {
        const chData = await api.slackChannels();
        const channels = chData.channels || chData || [];
        // Get recent messages from top channels
        let recentItems = [];
        for (const ch of channels.slice(0, 3)) {
          try {
            const msgs = await api.slackMessages(ch.id);
            const msgList = msgs.messages || [];
            msgList.slice(0, 2).forEach(m => {
              if (m.text && !m.text.includes('has joined the channel')) {
                recentItems.push({
                  text: `#${ch.name}: ${m.text.slice(0, 80)}`,
                  time: timeAgo(m.ts),
                  urgent: /urgent|escalat|ASAP|NOT CLEAR/i.test(m.text),
                });
              }
            });
          } catch (e) {}
        }
        setSlackData({ count: recentItems.length, items: recentItems });
      } catch (e) {
        setSlackData({ count: 0, items: [] });
      }
      setChannelsLoading(p => ({ ...p, slack: false }));
    })();

    const rcPromise = (async () => {
      try {
        const rc = await api.rcMessages();
        const convos = rc.conversations || [];
        const unread = convos.filter(c => (c.messages || []).some(m => m.readStatus === 'Unread'));
        setRcData({
          count: unread.length,
          items: convos.slice(0, 5).map(c => {
            const last = (c.messages || [])[0];
            return {
              text: `${c.contact}: ${last?.text || '(no text)'}`,
              time: timeAgo(last?.time),
              urgent: last?.readStatus === 'Unread',
            };
          }),
        });
      } catch (e) {
        setRcData({ count: 0, items: [] });
      }
      setChannelsLoading(p => ({ ...p, rc: false }));
    })();

    const qaPromise = (async () => {
      try {
        const qData = await api.questions('pending');
        setQuestions(qData.questions || qData || []);
      } catch (e) {
        setQuestions([]);
      }
      setChannelsLoading(p => ({ ...p, qa: false }));
    })();

    await Promise.all([emailPromise, slackPromise, rcPromise, qaPromise]);
    setLoading(false);
  }

  async function getElenaBriefing(forceRefresh = false) {
    // Cache Elena's briefing for 30 minutes
    const cache = window.__elenaBriefingCache;
    if (!forceRefresh && cache && (Date.now() - cache.time < 30 * 60 * 1000)) {
      setBriefing(cache.text);
      setBriefingLoading(false);
      return;
    }

    setBriefingLoading(true);
    try {
      // Use dedicated briefing endpoint — live-fetches Gmail + RingCentral server-side
      const res = await api.briefing();
      const text = res.briefing || res.response;
      setBriefing(text);
      window.__elenaBriefingCache = { text, time: Date.now() };
    } catch (e) {
      const fallback = "Hey Corey — I'm having a moment connecting, but your portal is loaded with the latest from all your channels. Take a look at the tiles below to see what's waiting.";
      setBriefing(fallback);
    }
    setBriefingLoading(false);
  }

  useEffect(() => {
    loadAllChannels();
    getElenaBriefing();
  }, []);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{greeting}, Corey</h1>
          <p className="text-surface-200/40 text-sm mt-1">Here's your world at a glance.</p>
        </div>
        <button onClick={() => { loadAllChannels(); getElenaBriefing(true); }} className="text-surface-200/30 hover:text-white transition">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Elena's Briefing — always first, always visible */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-600/10 to-brand-900/20 border-2 border-brand-600/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-brand-600/30 flex items-center justify-center">
            <Bot size={20} className="text-brand-500" />
          </div>
          <div>
            <h2 className="font-bold text-brand-400">Elena</h2>
            <p className="text-xs text-surface-200/40">Your briefing — just now</p>
          </div>
          <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Live
          </span>
        </div>
        {briefingLoading ? (
          <div className="flex items-center gap-3 py-4">
            <Loader size={18} className="animate-spin text-brand-500" />
            <span className="text-surface-200/50 text-sm">Elena is checking everything...</span>
          </div>
        ) : (
          <p className="text-surface-200/80 leading-relaxed whitespace-pre-wrap">{briefing}</p>
        )}
        <button
          onClick={() => onNavigate?.('/assistant')}
          className="mt-4 text-sm text-brand-500 hover:text-brand-400 flex items-center gap-1 transition"
        >
          Chat with Elena <ArrowRight size={14} />
        </button>
      </div>

      {/* Channel Buckets — big, visual, simple */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChannelBucket
          icon={Mail}
          label="Email"
          color="bg-blue-500"
          bgColor="border-blue-500/20 bg-blue-500/5"
          count={emailData.count}
          items={emailData.items}
          loading={channelsLoading.email}
          onDrilldown={() => onNavigate?.('/gmail')}
        />
        <ChannelBucket
          icon={Phone}
          label="Texts & Calls"
          color="bg-green-500"
          bgColor="border-green-500/20 bg-green-500/5"
          count={rcData.count}
          items={rcData.items}
          loading={channelsLoading.rc}
          onDrilldown={() => onNavigate?.('/ringcentral')}
        />
        <ChannelBucket
          icon={MessageSquare}
          label="Slack"
          color="bg-amber-500"
          bgColor="border-amber-500/20 bg-amber-500/5"
          count={slackData.count}
          items={slackData.items}
          loading={channelsLoading.slack}
          onDrilldown={() => onNavigate?.('/slack')}
        />
        <PendingQuestions questions={questions} loading={channelsLoading.qa} />
      </div>
    </div>
  );
}
