import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Cctv, 
  Radio, 
  AlertTriangle, 
  Users, 
  Box, 
  Car, 
  Database, 
  BarChart3, 
  Activity, 
  Settings,
  History,
  X
} from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Recognition Analytics', path: '/recognition-dashboard', icon: BarChart3 },
  { name: 'Cameras', path: '/cameras', icon: Cctv },
  { name: 'Live', path: '/live', icon: Radio },
  { name: 'Events', path: '/events', icon: AlertTriangle },
  { name: 'Attendance', path: '/attendance', icon: Users },
  { name: 'Recognition History', path: '/recognition-history', icon: History },
  { name: 'Objects', path: '/objects', icon: Box },
  { name: 'Vehicles', path: '/vehicles', icon: Car },
  { name: 'Evidence', path: '/evidence', icon: Database },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Health', path: '/health', icon: Activity },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  return (
    <aside 
      className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border h-full flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-border shrink-0">
        <div className="flex items-center gap-2 text-primary font-bold text-xl">
          <Cctv className="w-6 h-6" />
          <span>AI Surveillance</span>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="lg:hidden text-text-muted hover:text-text p-1 rounded-md hover:bg-surface-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 relative overflow-hidden',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:text-text hover:bg-surface-hover'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                  )}
                  <Icon className={cn("w-5 h-5 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110")} />
                  {item.name}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-border shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-surface-hover/50 border border-border/50 text-xs">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
          <span className="text-text-muted font-medium">System Online</span>
        </div>
        <div className="mt-3 text-[10px] text-text-muted/60 px-3 uppercase tracking-wider font-semibold">
          v0.1.0 (Enterprise)
        </div>
      </div>
    </aside>
  );
}
