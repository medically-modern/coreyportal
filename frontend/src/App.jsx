import React, { useState, useEffect } from 'react';
import { initFocusBlur } from './hooks/useFocusBlur';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import Dashboard from './components/Dashboard/Dashboard';
import GmailView from './components/Gmail/GmailView';
import QAView from './components/QA/QAView';
import RingCentralView from './components/RingCentral/RingCentralView';
import SlackView from './components/Slack/SlackView';
import AssistantView from './components/Assistant/AssistantView';
import ProjectsView from './components/Projects/ProjectsView';
import SubmitView from './components/Submit/SubmitView';
import ParkingLot from './components/Focus/ParkingLot';
import HyperfocusGuard from './components/Focus/HyperfocusGuard';
import KeyboardNav from './components/Focus/KeyboardNav';

function PortalLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCounts, setPendingCounts] = useState({});

  // Poll pending counts from dashboard state
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.__coreyPendingCounts) {
        setPendingCounts(window.__coreyPendingCounts);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-surface-900">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={`transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-56'}`}>
        <TopBar />
        <main className="p-6 max-w-6xl">
          {children}
        </main>
      </div>
      {/* Global ADHD tools */}
      <ParkingLot />
      <HyperfocusGuard pendingCounts={pendingCounts} />
      <KeyboardNav />
    </div>
  );
}

function DashboardWithNav() {
  const navigate = useNavigate();
  return <Dashboard onNavigate={(path) => navigate(path)} />;
}

export default function App() {
  useEffect(() => { initFocusBlur(); }, []);
  return (
    <Routes>
      {/* Employee submission page — standalone, no sidebar */}
      <Route path="/submit" element={<SubmitView />} />

      {/* Corey's portal — with sidebar */}
      <Route path="/*" element={
        <PortalLayout>
          <Routes>
            <Route path="/" element={<DashboardWithNav />} />
            <Route path="/gmail" element={<GmailView />} />
            <Route path="/questions" element={<QAView />} />
            <Route path="/ringcentral" element={<RingCentralView />} />
            <Route path="/slack" element={<SlackView />} />
            <Route path="/projects" element={<ProjectsView />} />
            <Route path="/assistant" element={<AssistantView />} />
          </Routes>
        </PortalLayout>
      } />
    </Routes>
  );
}
