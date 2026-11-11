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
  Cpu,
  FileText
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
      { name: 'Attendance', path: '/attendance', icon: Users },
      { name: 'Object Detection', path: '/objects', icon: Box },
      { name: 'Vehicle ANPR', path: '/vehicles', icon: Car },
      { name: 'Camera Matrix', path: '/cameras', icon: Cctv },
      { name: 'Threat Events', path: '/events', icon: AlertTriangle },
      { name: 'Review Queue', path: '/review-queue', icon: ShieldAlert, badgeKey: 'review' },
      { name: 'Live Feeds', path: '/live', icon: Radio },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { name: 'Face Analytics', path: '/recognition-dashboard', icon: BarChart3 },
      { name: 'Analytics Reports', path: '/analytics', icon: FileText },
      { name: 'Recognition Log', path: '/recognition-history', icon: History },
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
        "fixed lg:static inset-y-0 left-0 z-50 bg-[#070D1B] text-slate-300 border-r border-[#17233D] h-full flex flex-col transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none select-none",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        isCollapsed ? "w-20" : "w-68"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 sm:px-5 border-b border-[#17233D] shrink-0 bg-[#0A1224]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-500/25 ring-1 ring-white/20">
            <Cctv className="w-5 h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
            </span>
          </div>

          {!isCollapsed && (
            <div className="flex flex-col min-w-0" title="Multi Camera AI Surveillance & Real Time Analytics Platform">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs tracking-tight text-white whitespace-nowrap">MULTI-CAM AI</span>
                <span className="text-[9px] font-mono font-bold uppercase px-1 py-0.5 rounded bg-blue-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
                  PLATFORM
                </span>
              </div>
              <span className="text-[9px] text-slate-400 tracking-wider uppercase font-mono truncate font-semibold">
                Surveillance & Analytics
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button 
          onClick={() => setIsOpen(false)}
          className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop collapse toggle */}
        {setIsCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors ml-auto cursor-pointer"
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
              <div className="px-3 pb-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                {section.title}
              </div>
            ) : (
              <div className="h-px bg-[#17233D] my-2 mx-2" />
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
                        ? 'bg-gradient-to-r from-blue-600/30 to-cyan-500/15 text-white font-bold border border-blue-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
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
                          isActive ? "text-cyan-400 scale-110" : "text-slate-400 group-hover:text-white group-hover:scale-110"
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
      
      {/* System Status & Administrator Profile Footer */}
      <div className="p-3 border-t border-[#17233D] shrink-0 bg-[#0A1224] space-y-2.5">
        {!isCollapsed ? (
          <>
            {/* Neural Core Card */}
            <div className="rounded-xl p-2.5 bg-[#070D1B] border border-[#17233D]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <span className="text-xs font-semibold text-white">Neural Core</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">
                  ACTIVE
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono font-medium">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-cyan-400" />
                  Edge AI v2.4
                </span>
                <span>99.98% SLA</span>
              </div>
            </div>

            {/* Administrator Profile */}
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-[#070D1B] border border-[#17233D]">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-blue-400/40 bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150" 
                  alt="Rameez Ahmad" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span>RA</span>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-[#070D1B]" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold text-white truncate">Rameez Ahmad</span>
                <span className="text-[10px] text-cyan-400 font-mono font-semibold">Administrator</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1" title="Neural Core: ACTIVE | Administrator: Rameez Ahmad">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
            </span>
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
              RA
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
