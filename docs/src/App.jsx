import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import Dashboard from './components/Dashboard/Dashboard';
import GmailView from './components/Gmail/GmailView';
import QAView from './components/QA/QAView';
import RingCentralView from './components/RingCentral/RingCentralView';
import SlackView from './components/Slack/SlackView';
import MondayView from './components/Monday/MondayView';
import AssistantView from './components/Assistant/AssistantView';

export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-surface-900">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={`transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-56'}`}>
        <TopBar />
        <main className="p-6 max-w-6xl">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/gmail" element={<GmailView />} />
            <Route path="/questions" element={<QAView />} />
            <Route path="/ringcentral" element={<RingCentralView />} />
            <Route path="/slack" element={<SlackView />} />
            <Route path="/monday" element={<MondayView />} />
            <Route path="/assistant" element={<AssistantView />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
