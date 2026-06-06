import React, { useState, useEffect } from 'react';
import { Mail, Phone, MessageSquare, HelpCircle, AlertTriangle, Loader, Bot, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

function StatCard({ icon: Icon, label, value, color = 'text-white', urgent = false, loading }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${urgent ? 'bg-urgent/20' : 'bg-brand-600/20'}`}>
        <Icon size={20} className={urgent ? 'text-urgent' : 'text-brand-500'} />
      </div>
      <div>
        <p className="text-2xl font-bold">{loading ? '—' : value}</p>
        <p className="text-xs text-surface-200/60">{label}</p>
      </div>
    </div>
  );
}

function PriorityItem({ title, source, time, priority }) {
  const badge = priority === 'urgent' ? 'badge-urgent' : priority === 'warn' ? 'badge-warn' : 'badge-good';
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-200/5 last:border-0">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-surface-200/40 mt-0.5">{source} · {time}</p>
      </div>
      <span className={badge}>{priority}</span>
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ emails: 0, texts: 0, slackMsgs: 0, questions: 0 });
  const [feed, setFeed] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  async function loadDashboard() {
    setLoading(true);
    const items = [];

    try {
      // Gmail
      const gmailStatus = await api.gmailStatus().catch(() => ({ connected: false }));
      let emailCount = 0;
      if (gmailStatus.connected) {
        try {
          const unread = await api.gmailUnread();
          emailCount = unread.count || 0;
          const threadsData = await api.gmailThreads();
          const threads = threadsData.threads || threadsData || [];
          (threads).slice(0, 3).forEach(t => {
            items.push({
              title: `${t.from}: ${t.subject}`,
              source: 'Gmail',
              time: timeAgo(t.date),
              priority: t.unread ? 'warn' : 'good',
            });
          });
        } catch (e) {}
      }

      // Slack
      let slackCount = 0;
      try {
        const chData = await api.slackChannels();
        const channels = chData.channels || chData || [];
        const mainChannel = (channels).find(c => c.name === 'med-mod-onboarding') || (channels || [])[0];
        if (mainChannel) {
          const msgs = await api.slackMessages(mainChannel.id);
          const msgList = msgs.messages || msgs || [];
          slackCount = msgList.length;
          msgList.slice(0, 3).forEach(m => {
            items.push({
              title: `${m.user_name || 'Team'}: ${(m.text || '').slice(0, 80)}`,
              source: `Slack #${mainChannel.name}`,
              time: timeAgo(m.ts ? new Date(parseFloat(m.ts) * 1000).toISOString() : null),
              priority: (m.text || '').match(/urgent|escalat|ASAP|NOT CLEAR/i) ? 'urgent' : 'good',
            });
          });
        }
      } catch (e) {}

      // RingCentral
      let textCount = 0;
      try {
        const rc = await api.rcMessages();
        const convos = rc.conversations || [];
        textCount = convos.reduce((sum, c) => sum + (c.messages || []).filter(m => m.readStatus === 'Unread').length, 0);
        convos.slice(0, 3).forEach(c => {
          const lastMsg = (c.messages || [])[0];
          if (lastMsg) {
            items.push({
              title: `${c.contact}: ${lastMsg.text || '(no text)'}`,
              source: 'RingCentral',
              time: timeAgo(lastMsg.time),
              priority: lastMsg.readStatus === 'Unread' ? 'warn' : 'good',
            });
          }
        });
      } catch (e) {}

      // Q&A
      let qCount = 0;
      try {
        const qsData = await api.questions('pending');
        const qs = qsData.questions || qsData || [];
        qCount = qs.length;
        (qs).slice(0, 2).forEach(q => {
          items.push({
            title: q.question,
            source: `Q&A from ${q.from || 'Team'}`,
            time: timeAgo(q.created_at),
            priority: 'warn',
          });
        });
      } catch (e) {}

      // Sort by priority
      const order = { urgent: 0, warn: 1, good: 2 };
      items.sort((a, b) => (order[a.priority] || 2) - (order[b.priority] || 2));

      setStats({ emails: emailCount, texts: textCount, slackMsgs: slackCount, questions: qCount });
      setFeed(items);
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
    setLoading(false);
  }

  async function getAiSummary() {
    setSummaryLoading(true);
    try {
      const res = await api.chat("Give me a quick status briefing. What's the most important thing I should handle right now? Keep it to 3-4 sentences max.");
      setAiSummary(res.response);
    } catch (e) {
      setAiSummary("Couldn't connect to Elena right now. Check back in a moment.");
    }
    setSummaryLoading(false);
  }

  useEffect(() => { loadDashboard(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{greeting}, Corey</h1>
          <p className="text-surface-200/60 text-sm mt-1">Here's what needs your attention.</p>
        </div>
        <button onClick={loadDashboard} className="text-surface-200/40 hover:text-white">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Mail} label="Unread emails" value={stats.emails} loading={loading} />
        <StatCard icon={MessageSquare} label="Slack messages" value={stats.slackMsgs} loading={loading} />
        <StatCard icon={Phone} label="Unread texts" value={stats.texts} loading={loading} urgent={stats.texts > 0} />
        <StatCard icon={HelpCircle} label="Pending questions" value={stats.questions} loading={loading} />
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>Priority Feed — Live</span>
          {loading && <Loader size={14} className="animate-spin text-surface-200/40" />}
        </div>
        {feed.length === 0 && !loading && (
          <p className="text-sm text-surface-200/40 py-4">No items to show. Everything's clear!</p>
        )}
        {feed.slice(0, 8).map((item, i) => (
          <PriorityItem key={i} {...item} />
        ))}
      </div>

      <div className="card border-brand-600/30">
        <div className="card-header flex items-center gap-2">
          <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
          Elena's Take
        </div>
        {aiSummary ? (
          <p className="text-sm text-surface-200/80 leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
        ) : (
          <button onClick={getAiSummary} disabled={summaryLoading} className="btn-primary text-sm flex items-center gap-2">
            {summaryLoading ? <Loader size={14} className="animate-spin" /> : <Bot size={14} />}
            {summaryLoading ? 'Thinking...' : 'Get Elena\'s briefing'}
          </button>
        )}
      </div>
    </div>
  );
}
