import React from 'react';
import { Bell, Search } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="h-16 bg-surface-900 border-b border-surface-200/10 flex items-center justify-between px-6">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <Search size={18} className="text-surface-200/40" />
        <input
          type="text"
          placeholder="Search everything..."
          className="bg-transparent text-sm text-white placeholder-surface-200/40 outline-none flex-1"
        />
      </div>
      <div className="flex items-center gap-4">
        {/* Bell removed per Corey's request (badge count was hardcoded anyway)
        <button className="relative text-surface-200/60 hover:text-white">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-urgent rounded-full text-[10px] flex items-center justify-center font-bold">3</span>
        </button> */}
        <div className="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center text-sm font-bold">C</div>
      </div>
    </header>
  );
}
