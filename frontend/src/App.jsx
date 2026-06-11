import React, { useState, useEffect } from 'react';
import { initFocusBlur } from './hooks/useFocusBlur';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import Dashboard from './components/Dashboard/Dashboard';
import GmailView from './components/Gmail/GmailView';
import QAView from './components/QA/QAView';
import RingCentralView from './components/RingCentral/RingCentralView';
// import SlackView from './components/Slack/SlackView';  // hidden per Corey's request
import AssistantView from './components/Assistant/AssistantView';
import ProjectsView from './components/Projects/ProjectsView';
import NotesView from './components/Notes/NotesView';
import TrashView from './components/Trash/TrashView';
import SubmitView from './components/Submit/SubmitView';
import ParkingLot from './components/Focus/ParkingLot';
import HyperfocusGuard from './components/Focus/HyperfocusGuard';
import KeyboardNav from './components/Focus/KeyboardNav';
import ApiActivityIndicator from './components/shared/ApiActivityIndicator';

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
        <main className="p-6 w-full">
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
    <>
    <ApiActivityIndicator />
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
            {/* <Route path="/slack" element={<SlackView />} /> */}
            <Route path="/projects" element={<ProjectsView />} />
            <Route path="/notes" element={<NotesView />} />
            <Route path="/trash" element={<TrashView />} />
            <Route path="/assistant" element={<AssistantView />} />
          </Routes>
        </PortalLayout>
      } />
    </Routes>
    </>
  );
}
