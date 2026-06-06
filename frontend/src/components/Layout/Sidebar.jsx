import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Mail, MessageSquare, Phone,
  HelpCircle, Bot, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/gmail', icon: Mail, label: 'Gmail' },
  { to: '/questions', icon: HelpCircle, label: 'Questions' },
  { to: '/ringcentral', icon: Phone, label: 'Calls & Texts' },
  { to: '/slack', icon: MessageSquare, label: 'Slack' },
  { to: '/monday', icon: Calendar, label: 'Monday' },
];

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside className={`fixed top-0 left-0 h-screen bg-surface-900 border-r border-surface-200/10 flex flex-col transition-all duration-200 z-30 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-surface-200/10">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center font-bold text-sm">C</div>
        {!collapsed && <span className="ml-3 font-semibold text-lg">Corey Portal</span>}
      </div>

      {/* Nav */}
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
          </NavLink>
        ))}
      </nav>

      {/* Assistant quick access */}
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
          <Bot size={20} />
          {!collapsed && 'AI Assistant'}
        </NavLink>
      </div>

      {/* Collapse toggle */}
      <button onClick={onToggle} className="h-12 flex items-center justify-center border-t border-surface-200/10 text-surface-200/40 hover:text-white">
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
