import { useState, useEffect } from 'react';
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
  X,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Cpu
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../utils/cn';

interface NavSection {
  title: string;
  items: {
    name: string;
    path: string;
    icon: any;
    badgeKey?: string;
  }[];
}

const navSections: NavSection[] = [
  {
    title: 'OPERATIONS',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Live Feeds', path: '/live', icon: Radio },
      { name: 'Camera Matrix', path: '/cameras', icon: Cctv },
      { name: 'Threat Events', path: '/events', icon: AlertTriangle },
      { name: 'Review Queue', path: '/review-queue', icon: ShieldAlert, badgeKey: 'review' },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { name: 'Face Analytics', path: '/recognition-dashboard', icon: BarChart3 },
      { name: 'Personnel & Attendance', path: '/attendance', icon: Users },
      { name: 'Recognition Log', path: '/recognition-history', icon: History },
      { name: 'Object Detection', path: '/objects', icon: Box },
      { name: 'Vehicle & ANPR', path: '/vehicles', icon: Car },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { name: 'Evidence Vault', path: '/evidence', icon: Database },
      { name: 'System Analytics', path: '/analytics', icon: BarChart3 },
      { name: 'Node Health', path: '/health', icon: Activity },
      { name: 'Configuration', path: '/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (val: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen, isCollapsed = false, setIsCollapsed }: SidebarProps) {
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await api.get('/events/review-queue?limit=100');
        if (res.data) setReviewCount(res.data.length);
      } catch (e) {
        // Silently fail for polling
      }
    };
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside 
      className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 bg-[#070b15]/95 backdrop-blur-xl border-r border-border/80 h-full flex flex-col transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none select-none",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        isCollapsed ? "w-20" : "w-68"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 sm:px-5 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-500/25 ring-1 ring-white/20">
            <Cctv className="w-5 h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
            </span>
          </div>

          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white">AEGIS</span>
                <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  AI PRO
                </span>
              </div>
              <span className="text-[10px] text-text-muted/70 tracking-wider uppercase font-mono">
                Surveillance Grid
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button 
          onClick={() => setIsOpen(false)}
          className="lg:hidden text-text-muted hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop collapse toggle */}
        {setIsCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex text-text-muted hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors ml-auto"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>
      
      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5 scrollbar-hide">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!isCollapsed ? (
              <div className="px-3 pb-1 text-[10px] font-mono uppercase tracking-wider text-text-muted/60 font-semibold">
                {section.title}
              </div>
            ) : (
              <div className="h-px bg-border/40 my-2 mx-2" />
            )}

            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  title={isCollapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 relative overflow-hidden',
                      isActive
                        ? 'bg-gradient-to-r from-blue-600/20 to-cyan-500/10 text-white font-semibold shadow-inner border border-blue-500/30'
                        : 'text-text-muted hover:text-white hover:bg-white/5'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Active glow indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-400 to-cyan-400 rounded-r-full shadow-lg shadow-cyan-400/50" />
                      )}

                      <Icon
                        className={cn(
                          "w-4 h-4 shrink-0 transition-transform duration-200",
                          isActive ? "text-cyan-400 scale-110" : "text-text-muted group-hover:text-white group-hover:scale-110"
                        )}
                      />

                      {!isCollapsed && (
                        <span className="flex-1 truncate tracking-tight">{item.name}</span>
                      )}

                      {/* Review count alert chip */}
                      {item.badgeKey === 'review' && reviewCount > 0 && (
                        <span
                          className={cn(
                            "bg-rose-500 text-white text-[10px] font-mono font-bold rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30",
                            isCollapsed
                              ? "absolute top-1.5 right-1.5 h-4 w-4"
                              : "px-2 py-0.5"
                          )}
                        >
                          {reviewCount > 99 ? '99+' : reviewCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
      
      {/* System Status Footer */}
      <div className="p-3 border-t border-border/60 shrink-0 bg-[#050811]/60">
        {!isCollapsed ? (
          <div className="rounded-xl p-2.5 bg-surface/60 border border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span className="text-xs font-semibold text-text">Neural Core</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
                ACTIVE
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted/80 font-mono">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                Edge AI v2.4
              </span>
              <span>99.98% SLA</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1" title="Neural Core: ACTIVE">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
