import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Phone, MessageSquare, HelpCircle, Loader, RefreshCw, ChevronRight, CheckCircle2, ArrowRight, Zap, SkipForward, LayoutList, Sparkles, EyeOff, Eye } from 'lucide-react';
import { api } from '../../services/api';
import ElenaLogo from '../shared/ElenaLogo';
import DoThisNext from '../Focus/DoThisNext';
import ProgressRing from '../Focus/ProgressRing';
import WhereWasI from '../Focus/WhereWasI';

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

// Urgency decay: returns border/bg classes based on item age
function getDecayClasses(timeStr, isUrgent) {
  if (isUrgent) return 'border-l-urgent bg-urgent/5';
  const match = (timeStr || '').match(/(\d+)(m|h|d)/);
  if (!match) return 'border-l-good/50';
  const [, num, unit] = match;
  const mins = unit === 'm' ? +num : unit === 'h' ? +num * 60 : +num * 1440;
  if (mins > 1440) return 'border-l-urgent bg-urgent/5 animate-pulse-subtle';
  if (mins > 480) return 'border-l-urgent bg-urgent/5';
  if (mins > 120) return 'border-l-warn bg-warn/5';
  if (mins > 30) return 'border-l-amber-400/50';
  return 'border-l-good/50';
}

function ChannelBucket({ icon: Icon, label, color, bgColor, count, items, loading, onDrilldown, onDismissItem, onTriageItem }) {
  return (
    <div data-focus-item="" className={`rounded-2xl border-2 ${bgColor} p-6 transition-all hover:scale-[1.01]`}>
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
            <div
              key={i}
              className={`group flex items-center gap-2 text-sm text-surface-200/70 bg-surface-900/30 rounded-lg px-3 py-2 border-l-2 transition-all ${getDecayClasses(item.time, item.urgent)}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.urgent ? 'bg-urgent animate-pulse' : 'bg-surface-200/30'}`} />
              <span className="truncate flex-1">{item.text}</span>
              <span className="text-xs text-surface-200/30 shrink-0">{item.time}</span>
              {/* Inline triage — visible on hover */}
              <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onDismissItem?.(i); }}
                  className="p-1 rounded hover:bg-surface-200/10 text-surface-200/30 hover:text-surface-200/60 transition"
                  title="Dismiss"
                >
                  <SkipForward size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onTriageItem?.(i, 'elena'); }}
                  className="p-1 rounded hover:bg-brand-600/20 text-surface-200/30 hover:text-brand-400 transition"
                  title="Send to Elena"
                >
                  <ElenaLogo size={12} />
                </button>
              </div>
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
          <div key={i} className="group flex items-start gap-2 text-sm bg-surface-900/30 rounded-lg px-3 py-2">
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
  const [briefingStructured, setBriefingStructured] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingRequested, setBriefingRequested] = useState(false);
  const [emailData, setEmailData] = useState({ count: 0, items: [] });
  const [slackData, setSlackData] = useState({ count: 0, items: [] });
  const [rcData, setRcData] = useState({ count: 0, items: [] });
  const [questions, setQuestions] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState({ email: true, slack: true, rc: true, qa: true });
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('corey-view-mode') || 'focus');
  const [dismissedItems, setDismissedItems] = useState(new Set());
  const [elenaEnabled, setElenaEnabled] = useState(() => localStorage.getItem('corey-elena-enabled') !== 'false');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => { localStorage.setItem('corey-view-mode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('corey-elena-enabled', elenaEnabled); }, [elenaEnabled]);

  // Expose pending counts globally for HyperfocusGuard
  useEffect(() => {
    window.__coreyPendingCounts = {
      '/gmail': emailData.count,
      '/slack': slackData.count,
      '/ringcentral': rcData.count,
      '/questions': questions.length,
    };
  }, [emailData.count, slackData.count, rcData.count, questions.length]);

  async function loadAllChannels() {
    setLoading(true);
    setChannelsLoading({ email: true, slack: true, rc: true, qa: true });

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
              from: t.from || 'Unknown',
              subject: t.subject || '(no subject)',
              snippet: t.snippet || t.subject || '',
              time: timeAgo(t.date),
              urgent: t.unread,
              threadId: t.id,
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

    // Slack hidden per Corey's request — no fetch, keep shape empty
    const slackPromise = (async () => {
      setSlackData({ count: 0, items: [] });
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
              from: c.contact || 'Unknown',
              subject: last?.text?.slice(0, 80) || '(no text)',
              snippet: last?.text || '',
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

  // Load cached briefing from localStorage on mount (no API call)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('corey-elena-briefing');
      if (cached) {
        const data = JSON.parse(cached);
        // Only use cache less than 2 hours old
        if (data.time && (Date.now() - data.time < 2 * 60 * 60 * 1000)) {
          setBriefing(data.text || null);
          setBriefingStructured(data.structured || null);
          setBriefingRequested(true);
        }
      }
    } catch {}
  }, []);

  const getElenaBriefing = useCallback(async () => {
    setBriefingLoading(true);
    setBriefingRequested(true);
    try {
      const res = await api.briefing();
      const text = res.briefing || res.response;
      setBriefing(text);
      setBriefingStructured(res.structured || null);
      // Persist to localStorage so it survives reload
      const cacheData = { text, structured: res.structured || null, time: Date.now() };
      localStorage.setItem('corey-elena-briefing', JSON.stringify(cacheData));
    } catch (e) {
      const fallback = "Hey Corey — I'm having a moment connecting, but your portal is loaded with the latest from all your channels. Take a look at the tiles below to see what's waiting.";
      setBriefing(fallback);
    }
    setBriefingLoading(false);
  }, []);

  useEffect(() => {
    loadAllChannels();
  }, []);

  const totalItems = emailData.count + slackData.count + rcData.count + questions.length;
  const handledItems = dismissedItems.size;

  return (
    <div className="space-y-6 w-full">
      {/* Where Was I? banner */}
      <WhereWasI />

      {/* Header with Progress Ring */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{greeting}, Corey</h1>
          <p className="text-surface-200/40 text-sm mt-1">Here's your world at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing handled={handledItems} total={totalItems} />
          {/* View mode toggle */}
          <div className="flex bg-surface-200/10 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('focus')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                viewMode === 'focus' ? 'bg-brand-600 text-white' : 'text-surface-200/50 hover:text-white'
              }`}
              title="Do This Next — one item at a time"
            >
              <Zap size={12} /> Focus
            </button>
            <button
              onClick={() => setViewMode('buckets')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                viewMode === 'buckets' ? 'bg-brand-600 text-white' : 'text-surface-200/50 hover:text-white'
              }`}
              title="All channels view"
            >
              <LayoutList size={12} /> All
            </button>
          </div>
          {/* Elena on/off toggle */}
          <button
            onClick={() => setElenaEnabled(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              elenaEnabled ? 'bg-brand-600/20 text-brand-400' : 'bg-surface-200/10 text-surface-200/40'
            }`}
            title={elenaEnabled ? 'Hide Elena insights' : 'Show Elena insights'}
          >
            {elenaEnabled ? <Eye size={12} /> : <EyeOff size={12} />}
            Elena
          </button>
          <button onClick={() => { loadAllChannels(); if (briefingRequested) getElenaBriefing(); }} className="text-surface-200/30 hover:text-white transition">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Elena's Briefing — only shown when enabled */}
      {elenaEnabled && (
        <div className="rounded-2xl bg-gradient-to-br from-brand-600/10 to-brand-900/20 border-2 border-brand-600/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#1a2e2d] flex items-center justify-center p-1.5">
              <ElenaLogo size={28} />
            </div>
            <div>
              <h2 className="font-bold text-brand-400">Elena</h2>
              <p className="text-xs text-surface-200/40">
                {briefingRequested && (briefing || briefingStructured) ? 'Your briefing' : 'Ready when you are'}
              </p>
            </div>
            {briefingRequested && (briefing || briefingStructured) && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Live
              </span>
            )}
          </div>

          {/* Not yet requested — show button */}
          {!briefingRequested && !briefingLoading ? (
            <div className="flex flex-col items-center py-4 gap-3">
              <button
                onClick={getElenaBriefing}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium transition"
              >
                <Sparkles size={16} /> Get Briefing
              </button>
              <p className="text-xs text-surface-200/30">Elena will analyze your emails, texts, and messages</p>
            </div>
          ) : briefingLoading ? (
            <div className="flex items-center gap-3 py-4">
              <Loader size={18} className="animate-spin text-brand-500" />
              <span className="text-surface-200/50 text-sm">Elena is checking everything...</span>
            </div>
          ) : briefingStructured ? (
            <div className="space-y-4">
              {/* Greeting */}
              <p className="text-surface-200/80 text-sm leading-relaxed">{briefingStructured.greeting}</p>

              {/* Urgent items */}
              {briefingStructured.urgent?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-bad uppercase tracking-wider">Needs Attention Now</p>
                  {briefingStructured.urgent.map((u, i) => (
                    <div key={i} className="rounded-lg bg-bad/10 border border-bad/20 px-3 py-2">
                      <p className="text-sm font-medium text-white">{u.label}</p>
                      <p className="text-xs text-surface-200/60 mt-0.5">{u.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Overview counters */}
              {briefingStructured.overview && (
                <div className="flex flex-wrap gap-3">
                  {briefingStructured.overview.emails > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-200/5 text-xs text-surface-200/60">
                      <Mail size={11} /> {briefingStructured.overview.emails} emails
                    </span>
                  )}
                  {briefingStructured.overview.texts > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-200/5 text-xs text-surface-200/60">
                      <Phone size={11} /> {briefingStructured.overview.texts} texts
                    </span>
                  )}
                  {briefingStructured.overview.missed_calls > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-xs text-amber-400">
                      <Phone size={11} /> {briefingStructured.overview.missed_calls} missed
                    </span>
                  )}
                  {briefingStructured.overview.team_questions > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-200/5 text-xs text-surface-200/60">
                      <MessageSquare size={11} /> {briefingStructured.overview.team_questions} questions
                    </span>
                  )}
                </div>
              )}

              {/* Item list */}
              {briefingStructured.items?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-surface-200/40 uppercase tracking-wider">On Your Plate</p>
                  {briefingStructured.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5">
                      <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        item.type === 'text' ? 'bg-green-400' :
                        item.type === 'email' ? 'bg-blue-400' :
                        item.type === 'call' ? 'bg-amber-400' :
                        'bg-purple-400'
                      }`} />
                      <div>
                        <span className="text-sm font-medium text-surface-200/80">{item.label}</span>
                        <span className="text-sm text-surface-200/50 ml-1.5">— {item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Next step */}
              {briefingStructured.next_step && (
                <div className="rounded-lg bg-brand-600/10 border border-brand-600/20 px-3 py-2.5">
                  <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">Start Here</p>
                  <p className="text-sm text-white font-medium leading-relaxed">{briefingStructured.next_step}</p>
                </div>
              )}

              {/* Refresh briefing button */}
              <button
                onClick={getElenaBriefing}
                className="text-xs text-surface-200/30 hover:text-brand-400 flex items-center gap-1 transition"
              >
                <RefreshCw size={10} /> Refresh briefing
              </button>
            </div>
          ) : briefing ? (
            <p className="text-surface-200/80 leading-relaxed whitespace-pre-wrap">{briefing}</p>
          ) : null}
          <button
            onClick={() => onNavigate?.('/assistant')}
            className="mt-4 text-sm text-brand-500 hover:text-brand-400 flex items-center gap-1 transition"
          >
            Chat with Elena <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Content: Focus mode or Bucket mode */}
      {viewMode === 'focus' ? (
        <DoThisNext
          emailData={emailData}
          slackData={slackData}
          rcData={rcData}
          questions={questions}
          onNavigate={onNavigate}
          onDismiss={(id) => setDismissedItems(prev => new Set(prev).add(id))}
          elenaEnabled={elenaEnabled}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-focus-group>
          <ChannelBucket
            icon={Mail} label="Email" color="bg-blue-500"
            bgColor="border-blue-500/20 bg-blue-500/5"
            count={emailData.count} items={emailData.items}
            loading={channelsLoading.email}
            onDrilldown={() => onNavigate?.('/gmail')}
            onDismissItem={(i) => setDismissedItems(prev => new Set(prev).add(`email-${i}`))}
            onTriageItem={(i, action) => console.log('triage', i, action)}
          />
          <ChannelBucket
            icon={Phone} label="Texts & Calls" color="bg-green-500"
            bgColor="border-green-500/20 bg-green-500/5"
            count={rcData.count} items={rcData.items}
            loading={channelsLoading.rc}
            onDrilldown={() => onNavigate?.('/ringcentral')}
            onDismissItem={(i) => setDismissedItems(prev => new Set(prev).add(`rc-${i}`))}
            onTriageItem={(i, action) => console.log('triage', i, action)}
          />
          {/* Slack bucket hidden per Corey's request */}
          <PendingQuestions questions={questions} loading={channelsLoading.qa} />
        </div>
      )}
    </div>
  );
}
