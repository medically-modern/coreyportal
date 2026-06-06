import React, { useState, useEffect } from 'react';
import { Mail, Phone, HelpCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const MOCK_STATS = {
  unreadEmails: 12,
  pendingQuestions: 8,
  missedCalls: 3,
  unrepliedTexts: 5,
  urgentItems: 4,
};

function StatCard({ icon: Icon, label, value, color = 'text-white', urgent = false }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${urgent ? 'bg-urgent/20' : 'bg-brand-600/20'}`}>
        <Icon size={20} className={urgent ? 'text-urgent' : 'text-brand-500'} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
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

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Good morning, Corey</h1>
        <p className="text-surface-200/60 text-sm mt-1">Here's what needs your attention today.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Mail} label="Unread emails" value={MOCK_STATS.unreadEmails} />
        <StatCard icon={HelpCircle} label="Pending questions" value={MOCK_STATS.pendingQuestions} />
        <StatCard icon={Phone} label="Missed calls" value={MOCK_STATS.missedCalls} urgent />
        <StatCard icon={AlertTriangle} label="Urgent items" value={MOCK_STATS.urgentItems} urgent />
      </div>

      {/* Priority feed */}
      <div className="card">
        <div className="card-header">Priority Feed — AI Triaged</div>
        <PriorityItem title="Voicemail from Dr. Reynolds about CPAP order" source="RingCentral" time="23 min ago" priority="urgent" />
        <PriorityItem title="Slack: Sarah asked about insurance verification process" source="Questions" time="1 hr ago" priority="warn" />
        <PriorityItem title="Gmail: Supplier invoice needs approval ($2,400)" source="Gmail" time="2 hrs ago" priority="warn" />
        <PriorityItem title="Monday: DME compliance checklist due Friday" source="Monday" time="Today" priority="good" />
        <PriorityItem title="Text from Mike: shipping delay on wheelchair order" source="RingCentral" time="3 hrs ago" priority="urgent" />
      </div>

      {/* AI Summary */}
      <div className="card border-brand-600/30">
        <div className="card-header flex items-center gap-2">
          <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
          Claude's Take
        </div>
        <p className="text-sm text-surface-200/80 leading-relaxed">
          You have <strong>4 urgent items</strong> this morning. The voicemail from Dr. Reynolds and Mike's shipping delay 
          should be handled first — both are customer-facing. Sarah's question about insurance verification is something 
          I can draft a response for if you'd like. The supplier invoice is routine but due today.
        </p>
        <button className="btn-primary mt-4 text-sm">Let Claude handle the easy ones</button>
      </div>
    </div>
  );
}
