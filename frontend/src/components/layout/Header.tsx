import React, { useState } from 'react';
import { Bell, Search, Sun, Moon, ChevronDown, LogOut, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';

export function Header({ onMenuClick: _onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes('cam')) navigate('/cameras');
    else if (q.includes('event') || q.includes('alert') || q.includes('threat')) navigate('/events');
    else if (q.includes('vehicle') || q.includes('car') || q.includes('plate') || q.includes('anpr')) navigate('/vehicles');
    else if (q.includes('face') || q.includes('person') || q.includes('attend') || q.includes('emp')) navigate('/attendance');
    else if (q.includes('obj')) navigate('/objects');
    else if (q.includes('review')) navigate('/review-queue');
    else if (q.includes('report') || q.includes('analytic')) navigate('/analytics');
    else navigate(`/attendance?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white/80 dark:bg-surface/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-border flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0 z-30 transition-colors">
      {/* Global Search Field */}
      <div className="flex-1 max-w-xl">
        <form onSubmit={handleSearchSubmit} className="relative group">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employees, events..." 
            className="w-full bg-slate-50 dark:bg-surface-card border border-slate-200/80 dark:border-border rounded-full pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-2xs"
          />
        </form>
      </div>

      {/* Right Controls: Theme Toggle, Notifications (Count 3), Admin Profile */}
      <div className="flex items-center gap-3 sm:gap-4 ml-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-hover rounded-full transition-colors cursor-pointer"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'light' ? (
            <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300" />
          )}
        </button>

        {/* Notifications Icon with count "3" */}
        <button 
          onClick={() => navigate('/events')}
          className="relative p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-hover rounded-full transition-colors cursor-pointer"
          aria-label="Security Notifications"
          title="3 Security Alerts"
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
            3
          </span>
        </button>

        {/* Admin Profile with Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2.5 pl-2 pr-1 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-surface-hover transition-colors cursor-pointer"
          >
            {/* User Avatar */}
            <div className="w-9 h-9 rounded-full overflow-hidden border border-blue-200 dark:border-blue-500/30 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150" 
                alt="Rameez Ahmad" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to avatar initial
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="fallback-initial">RA</span>
            </div>

            {/* User Name & Role */}
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                Rameez Ahmad
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Admin
              </div>
            </div>

            {/* Dropdown Chevron */}
            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", isProfileMenuOpen && "rotate-180")} />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-surface-card border border-slate-200 dark:border-border shadow-xl py-1.5 z-50 animate-fade-in text-xs">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-border">
                <p className="font-bold text-slate-900 dark:text-white">Rameez Ahmad</p>
                <p className="text-[11px] text-slate-500 dark:text-text-muted">Administrator</p>
              </div>

              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  navigate('/settings');
                }}
                className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-hover flex items-center gap-2 cursor-pointer"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>System Settings</span>
              </button>

              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  navigate('/health');
                }}
                className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-hover flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Node Health</span>
              </button>

              <div className="border-t border-slate-100 dark:border-border my-1" />

              <button
                onClick={handleLogout}
                className="w-full px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 cursor-pointer font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
