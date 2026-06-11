import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Mail, MessageSquare, Phone,
  ChevronLeft, ChevronRight, HelpCircle, FolderKanban, StickyNote, Trash2, AlarmClock
} from 'lucide-react';
import ElenaLogo from '../shared/ElenaLogo';
import { snoozedList, subscribeSnooze } from '../../utils/snoozeStore';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/gmail', icon: Mail, label: 'Email' },
  { to: '/ringcentral', icon: Phone, label: 'Texts & Calls' },
  // { to: '/slack', icon: MessageSquare, label: 'Slack' },  // hidden per Corey's request
  { to: '/questions', icon: HelpCircle, label: 'Team Questions' },
  { to: '/snoozed', icon: AlarmClock, label: 'Snoozed' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/notes', icon: StickyNote, label: 'Parking Lot' },
  { to: '/trash', icon: Trash2, label: 'Trash' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const [snoozedCount, setSnoozedCount] = useState(snoozedList().length);

  useEffect(() => {
    const unsub = subscribeSnooze(() => setSnoozedCount(snoozedList().length));
    const t = setInterval(() => setSnoozedCount(snoozedList().length), 60 * 1000);
    return () => { unsub(); clearInterval(t); };
  }, []);

  return (
    <aside className={`fixed top-0 left-0 h-screen bg-surface-900 border-r border-surface-200/10 flex flex-col transition-all duration-200 z-30 ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="h-16 flex items-center px-4 border-b border-surface-200/10">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center font-bold text-sm">C</div>
        {!collapsed && <span className="ml-3 font-semibold text-lg">Corey Portal</span>}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand-600/20 text-brand-500 font-medium'
                  : 'text-surface-200/60 hover:text-white hover:bg-surface-800'
              }`
            }
          >
            <Icon size={20} />
            {!collapsed && label}
            {to === '/snoozed' && snoozedCount > 0 && !collapsed && (
              <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">{snoozedCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 pb-4">
        <NavLink
          to="/assistant"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-brand-600/20 text-brand-500 font-medium'
                : 'text-surface-200/60 hover:text-white hover:bg-surface-800'
            }`
          }
        >
          <ElenaLogo size={20} />
          {!collapsed && 'Elena'}
        </NavLink>
      </div>

      <button onClick={onToggle} className="h-12 flex items-center justify-center border-t border-surface-200/10 text-surface-200/40 hover:text-white">
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
