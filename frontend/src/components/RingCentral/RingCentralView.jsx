import React, { useState } from 'react';
import { Phone, MessageSquare, Voicemail, Bot, ChevronDown } from 'lucide-react';

const MOCK_TEXTS = [
  { id: 1, contact: 'Mike (Warehouse)', lastMsg: 'The wheelchair shipment is delayed 2 days', time: '3 hrs ago', unread: 2 },
  { id: 2, contact: 'Dr. Reynolds', lastMsg: 'Can you call me about the CPAP order?', time: '5 hrs ago', unread: 1 },
  { id: 3, contact: 'Lisa (Sales)', lastMsg: 'New lead from the health fair — DME referral', time: 'Yesterday', unread: 0 },
];

const MOCK_VOICEMAILS = [
  { id: 1, from: 'Dr. Reynolds', duration: '1:23', time: '23 min ago', transcription: null },
  { id: 2, from: 'Insurance Rep (Aetna)', duration: '0:45', time: '2 hrs ago', transcription: null },
];

function TextConvo({ convo, onSummarize }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-surface-200/5 hover:bg-surface-800/50 cursor-pointer">
      <div className="w-10 h-10 bg-surface-800 rounded-full flex items-center justify-center text-sm font-bold">
        {convo.contact.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{convo.contact}</span>
          {convo.unread > 0 && <span className="w-5 h-5 bg-brand-600 rounded-full text-[10px] flex items-center justify-center font-bold">{convo.unread}</span>}
        </div>
        <p className="text-xs text-surface-200/40 truncate">{convo.lastMsg}</p>
      </div>
      <span className="text-xs text-surface-200/40">{convo.time}</span>
      <button onClick={(e) => { e.stopPropagation(); onSummarize(convo.id); }} className="text-brand-500 hover:text-brand-400" title="AI Summarize">
        <Bot size={16} />
      </button>
    </div>
  );
}

function VoicemailRow({ vm }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-surface-200/5">
      <div className="flex items-center gap-4 px-4 py-3 hover:bg-surface-800/50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <Voicemail size={18} className="text-surface-200/40" />
        <div className="flex-1">
          <span className="text-sm font-medium">{vm.from}</span>
          <span className="text-xs text-surface-200/40 ml-2">{vm.duration}</span>
        </div>
        <span className="text-xs text-surface-200/40">{vm.time}</span>
        <button className="text-brand-500 hover:text-brand-400 text-xs flex items-center gap-1">
          <Bot size={14} /> Transcribe
        </button>
        <ChevronDown size={16} className={`text-surface-200/40 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
      {expanded && (
        <div className="px-4 pb-3 ml-10">
          <p className="text-xs text-surface-200/60 italic">Transcription will appear here after processing...</p>
        </div>
      )}
    </div>
  );
}

export default function RingCentralView() {
  const [tab, setTab] = useState('texts');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Phone size={22} /> Calls & Texts</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setTab('texts')} className={`text-xs px-3 py-1.5 rounded-lg ${tab === 'texts' ? 'bg-brand-600 text-white' : 'bg-surface-800 text-surface-200/60'}`}>
            <MessageSquare size={14} className="inline mr-1" />Texts
          </button>
          <button onClick={() => setTab('voicemails')} className={`text-xs px-3 py-1.5 rounded-lg ${tab === 'voicemails' ? 'bg-brand-600 text-white' : 'bg-surface-800 text-surface-200/60'}`}>
            <Voicemail size={14} className="inline mr-1" />Voicemails
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {tab === 'texts' && MOCK_TEXTS.map((c) => <TextConvo key={c.id} convo={c} onSummarize={() => {}} />)}
        {tab === 'voicemails' && MOCK_VOICEMAILS.map((vm) => <VoicemailRow key={vm.id} vm={vm} />)}
      </div>
    </div>
  );
}
