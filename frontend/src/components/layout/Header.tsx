import { useState, useEffect } from 'react';
import { Bell, Search, User, Menu, Sun, Moon, Clock, Command } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const rawPath = location.pathname.split('/')[1] || 'dashboard';
  
  // Format readable page title
  const formattedTitle = rawPath
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const { theme, toggleTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // Route to appropriate page if matching keyword
    const q = searchQuery.toLowerCase();
    if (q.includes('cam')) navigate('/cameras');
    else if (q.includes('event') || q.includes('alert')) navigate('/events');
    else if (q.includes('vehicle') || q.includes('car') || q.includes('plate')) navigate('/vehicles');
    else if (q.includes('face') || q.includes('person') || q.includes('attend')) navigate('/attendance');
    else if (q.includes('obj')) navigate('/objects');
    else if (q.includes('review')) navigate('/review-queue');
  };

  return (
    <header className="h-16 bg-[#070b15]/90 backdrop-blur-xl border-b border-border/80 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
      {/* Left: Mobile Menu Toggle & Page Context */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-text-muted hover:text-white hover:bg-white/5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {formattedTitle}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                SECURE
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Center/Right: Global Search, Real-Time Clock, Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative hidden md:block group">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cameras, events, plates..." 
            className="bg-surface/80 border border-border/80 rounded-xl pl-9 pr-8 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 text-white placeholder-text-muted/60 w-52 lg:w-72 transition-all duration-200"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 text-[10px] text-text-muted/60 bg-white/5 px-1 rounded border border-white/10 font-mono">
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </div>
        </form>

        {/* Real-time Clock */}
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface/60 border border-border/60 text-xs font-mono text-cyan-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{currentTime || '00:00:00'}</span>
        </div>
        
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="relative p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 group border border-transparent hover:border-border/60"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          <div className="relative w-4 h-4 sm:w-5 sm:h-5">
            <Sun 
              className={cn(
                "w-full h-full absolute inset-0 transition-all duration-300",
                theme === 'light' 
                  ? 'opacity-100 rotate-0 scale-100 text-amber-400' 
                  : 'opacity-0 rotate-90 scale-50'
              )} 
            />
            <Moon 
              className={cn(
                "w-full h-full absolute inset-0 transition-all duration-300",
                theme === 'dark' 
                  ? 'opacity-100 rotate-0 scale-100 text-cyan-300' 
                  : 'opacity-0 -rotate-90 scale-50'
              )} 
            />
          </div>
        </button>

        {/* Notifications Button */}
        <button 
          onClick={() => navigate('/events')}
          className="relative p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 border border-transparent hover:border-border/60"
          aria-label="Notifications"
          title="Security Alerts"
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
        </button>
        
        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-border/60">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-white leading-tight">Admin Operator</div>
            <div className="text-[10px] text-cyan-400/90 font-mono">NODE-ALPHA</div>
          </div>
          <button 
            onClick={() => navigate('/settings')}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 ring-offset-2 ring-offset-background"
            aria-label="User settings"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
