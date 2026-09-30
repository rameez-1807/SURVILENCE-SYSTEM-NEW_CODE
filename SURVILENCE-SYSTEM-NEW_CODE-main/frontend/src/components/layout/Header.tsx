import { Bell, Search, User, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  const title = location.pathname.split('/')[1] || 'Dashboard';
  const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1);

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-text-muted hover:text-text hover:bg-surface-hover rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg sm:text-xl font-semibold text-text truncate">{capitalizedTitle}</h1>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative hidden md:block group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search global..." 
            className="bg-background border border-border rounded-md pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text placeholder-text-muted w-48 lg:w-64 transition-all duration-200"
          />
        </div>
        
        <button 
          className="relative p-2 text-text-muted hover:text-text hover:bg-surface-hover rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full ring-2 ring-surface"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-2 sm:pl-4 sm:border-l border-border">
          <div className="text-right hidden lg:block">
            <div className="text-sm font-medium text-text leading-tight">Admin User</div>
            <div className="text-[11px] text-text-muted">Platform Admin</div>
          </div>
          <button 
            className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary ring-offset-2 ring-offset-surface"
            aria-label="User profile"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
