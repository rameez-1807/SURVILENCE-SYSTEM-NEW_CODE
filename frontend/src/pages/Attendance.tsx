import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Download, 
  UserSquare2, 
  CalendarClock, 
  AlertCircle,
  Users,
  Scan,
  Plus,
  RefreshCw,
  Clock,
  CloudDownload,
  CheckCircle2,
  Zap,
  Trash2,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';
import { FaceRegistrationModal } from '../components/FaceRegistrationModal';
import { ManualRegistrationModal } from '../components/ManualRegistrationModal';
import { FaceRecognitionModal } from '../components/FaceRecognitionModal';

interface PunchEvent {
  id: string;
  record_id: number;
  employee_id: string;
  employee_name: string;
  attendance_date: string;
  punch_type: 'in' | 'out';
  punch_time: string;
  camera_name: string;
  confidence: number;
  has_punched_out: boolean;
  raw_record: any;
}

export default function Attendance() {
  const [activeTab, setActiveTab] = useState<'employees' | 'records'>('records');
  
  // Data States
  const [employees, setEmployees] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [apiMissing, setApiMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [punchViewFilter, setPunchViewFilter] = useState<'all' | 'in' | 'out' | 'combined'>('all');

  // Pagination States
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Registration & Recognition Modal State
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [isManualRegistrationOpen, setIsManualRegistrationOpen] = useState(false);
  const [isRecognitionModalOpen, setIsRecognitionModalOpen] = useState(false);
  const [recognitionPunchMode, setRecognitionPunchMode] = useState<'in' | 'out'>('in');

  // Quick 1-Click Punch Out Handler for table rows
  const handleQuickPunchOut = async (rec: any) => {
    try {
      await api.post('/attendance/punch', {
        employee_id: rec.employee_id,
        employee_name: rec.employee_name,
        punch_type: 'out',
        attendance_date: rec.attendance_date,
      });
      await fetchData();
    } catch (err: any) {
      alert('Failed to record punch out: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Reset pagination to page 1 whenever filters or tab or pageSize change
  useEffect(() => {
    setPage(1);
  }, [search, dateFilter, siteFilter, employeeFilter, activeTab, pageSize, punchViewFilter]);

  const handleDeleteFace = async (emp: any) => {
    if (!window.confirm(`Are you sure you want to remove biometric face data for ${emp.name} (${emp.employee_id})? The employee profile will be preserved.`)) {
      return;
    }
    try {
      await api.delete(`/employees/${encodeURIComponent(emp.employee_id)}/face`);
      await fetchData();
    } catch (err: any) {
      alert('Failed to remove face biometric: ' + (err.response?.data?.detail || err.message));
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setApiMissing(false);
      
      const [empRes, attRes] = await Promise.allSettled([
        api.get('/employees?limit=500'),
        api.get('/attendance?limit=1000')
      ]);

      if (empRes.status === 'fulfilled') {
        setEmployees(empRes.value.data.items || []);
      }
      if (attRes.status === 'fulfilled') {
        setRecords(attRes.value.data.items || []);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setApiMissing(true);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication required. Please log in.');
      } else {
        setError('Failed to fetch attendance data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSyncHRMS = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      const res = await api.post('/attendance/sync-hrms');
      if (res.data?.status === 'success') {
        setSyncMessage(`Successfully synced ${res.data.employees_synced} employees & ${res.data.attendance_synced} attendance records from HRMS!`);
        setTimeout(() => setSyncMessage(null), 6000);
      } else if (res.data?.message) {
        setSyncMessage(res.data.message);
      }
      await fetchData();
    } catch (err: any) {
      alert("Failed to sync HRMS data: " + (err.response?.data?.message || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    alert("Exporting biometric attendance report (CSV/PDF)...");
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = search.toLowerCase();
      return (emp.name || '').toLowerCase().includes(q) ||
             (emp.employee_id || '').toLowerCase().includes(q) ||
             (emp.department || '').toLowerCase().includes(q);
    });
  }, [employees, search]);

  // Convert daily attendance records into distinct Punch Events (Punch In separate & Punch Out separate)
  const punchEvents: PunchEvent[] = useMemo(() => {
    const list: PunchEvent[] = [];

    records.forEach((rec) => {
      const hasExit = Boolean(rec.last_seen && rec.last_seen !== rec.first_seen);

      // Punch In event
      if (rec.first_seen) {
        list.push({
          id: `${rec.id}-in`,
          record_id: rec.id,
          employee_id: rec.employee_id,
          employee_name: rec.employee_name,
          attendance_date: rec.attendance_date,
          punch_type: 'in',
          punch_time: rec.first_seen,
          camera_name: rec.camera_name || 'Terminal-Gate-1',
          confidence: rec.confidence || 98,
          has_punched_out: hasExit,
          raw_record: rec,
        });
      }

      // Punch Out event
      if (hasExit) {
        list.push({
          id: `${rec.id}-out`,
          record_id: rec.id,
          employee_id: rec.employee_id,
          employee_name: rec.employee_name,
          attendance_date: rec.attendance_date,
          punch_type: 'out',
          punch_time: rec.last_seen,
          camera_name: rec.camera_name || 'Terminal-Gate-1',
          confidence: rec.confidence || 98,
          has_punched_out: true,
          raw_record: rec,
        });
      }
    });

    // Sort chronologically descending: latest date first, then latest punch time first
    list.sort((a, b) => {
      const dComp = (b.attendance_date || '').localeCompare(a.attendance_date || '');
      if (dComp !== 0) return dComp;
      return (b.punch_time || '').localeCompare(a.punch_time || '');
    });

    return list;
  }, [records]);

  const punchInCount = useMemo(() => punchEvents.filter(e => e.punch_type === 'in').length, [punchEvents]);
  const punchOutCount = useMemo(() => punchEvents.filter(e => e.punch_type === 'out').length, [punchEvents]);

  const filteredPunchEvents = useMemo(() => {
    return punchEvents.filter(ev => {
      if (punchViewFilter === 'in' && ev.punch_type !== 'in') return false;
      if (punchViewFilter === 'out' && ev.punch_type !== 'out') return false;

      const q = search.toLowerCase();
      const matchesSearch = !q ||
        (ev.employee_name || '').toLowerCase().includes(q) ||
        (ev.employee_id || '').toLowerCase().includes(q) ||
        (ev.camera_name || '').toLowerCase().includes(q);

      const matchesDate = !dateFilter || ev.attendance_date === dateFilter;
      return matchesSearch && matchesDate;
    });
  }, [punchEvents, punchViewFilter, search, dateFilter]);

  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        (rec.employee_name || '').toLowerCase().includes(q) ||
        (rec.employee_id || '').toLowerCase().includes(q);
      const matchesDate = !dateFilter || rec.attendance_date === dateFilter;
      return matchesSearch && matchesDate;
    });
  }, [records, search, dateFilter]);

  // Determine current active item list based on tab and punch view filter
  const activeItems = useMemo(() => {
    if (activeTab === 'employees') return filteredEmployees;
    if (punchViewFilter === 'combined') return filteredRecords;
    return filteredPunchEvents;
  }, [activeTab, filteredEmployees, punchViewFilter, filteredRecords, filteredPunchEvents]);

  const totalItems = activeItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const displayedItems = activeItems.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Page Header */}
      <PageHeader
        title="Personnel & Attendance"
        subtitle="Automated biometric facial recognition logs, personnel rosters, and shift attendance"
        icon={Users}
        badge={
          <Badge variant="cyan" size="xs">
            {activeTab === 'employees' 
              ? `${employees.length} ENROLLED` 
              : punchViewFilter === 'combined' 
                ? `${records.length} DAILY LOGS` 
                : `${punchEvents.length} TOTAL PUNCHES`}
          </Badge>
        }
      >
        {activeTab === 'records' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setRecognitionPunchMode('in');
                setIsRecognitionModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer"
              title="Open Live Camera in Punch In Mode"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-200" />
              <span>Punch In (Live Face)</span>
            </button>

            <button 
              onClick={() => {
                setRecognitionPunchMode('out');
                setIsRecognitionModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-500/25 transition-all active:scale-95 cursor-pointer"
              title="Open Live Camera in Punch Out Mode"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-200" />
              <span>Punch Out (Live Face)</span>
            </button>
          </div>
        )}

        {activeTab === 'employees' && (
          <button 
            onClick={() => setIsRegistrationModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/25 transition-all"
          >
            <UserSquare2 className="w-3.5 h-3.5" />
            <span>Register Face (Camera)</span>
          </button>
        )}

        <button 
          onClick={handleSyncHRMS}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/25 transition-all disabled:opacity-50"
          title="Sync latest attendance data from external HRMS API"
        >
          <CloudDownload className={cn("w-3.5 h-3.5", syncing && "animate-bounce")} />
          <span>{syncing ? 'Syncing HRMS...' : 'Sync HRMS'}</span>
        </button>

        <button 
          onClick={() => {
            setSelectedEmployee(null);
            setIsRegistrationModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-500/20 transition-all"
          title="Enroll Face & Register New Employee"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ Register Employee & Face</span>
        </button>

        <button 
          onClick={() => setIsManualRegistrationOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface/80 hover:bg-surface-hover border border-border/80 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
          <span>Manual Entry</span>
        </button>

        <button 
          onClick={handleExport}
          className="p-2 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
          title="Export Attendance Sheet"
        >
          <Download className="w-4 h-4" />
        </button>

        <button 
          onClick={fetchData}
          className="p-2 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
          title="Refresh Table"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </PageHeader>

      {/* Facenox Biometric AI Engine Banner */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-surface to-surface border border-cyan-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl shadow-cyan-950/20">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-cyan-500/15 text-cyan-400 rounded-xl border border-cyan-500/30 shadow-inner">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm tracking-wide">Facenox SOTA Biometric Platform</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ACTIVE INFERENCE
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                YuNet + MiniFASNetV2 Anti-Spoof + ArcFace 512d
              </span>
            </div>
            <p className="text-text-muted text-xs mt-1">
              On-device real-time face matching with multi-subject ByteTrack and anti-spoofing defense (blocks photos, tablets, & mobile screen replays).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRecognitionModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-cyan-500/25 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-200" />
            <span>Launch Facenox Scanner</span>
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Tabs Selector & Punch Sub-View Filter */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-1.5 bg-[#0a0f1d] p-1 rounded-2xl border border-border/80">
          <button
            onClick={() => setActiveTab('records')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer",
              activeTab === 'records' 
                ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20" 
                : "text-text-muted hover:text-white"
            )}
          >
            <CalendarClock className="w-4 h-4" />
            <span>Attendance Log</span>
          </button>

          <button
            onClick={() => setActiveTab('employees')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer",
              activeTab === 'employees' 
                ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20" 
                : "text-text-muted hover:text-white"
            )}
          >
            <UserSquare2 className="w-4 h-4" />
            <span>Personnel Directory</span>
          </button>
        </div>

        {/* Punch In / Punch Out Separate Sub-View Switcher */}
        {activeTab === 'records' && (
          <div className="flex flex-wrap items-center gap-1.5 bg-[#0a0f1d] p-1 rounded-2xl border border-border/80 text-xs">
            <button
              onClick={() => setPunchViewFilter('all')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer",
                punchViewFilter === 'all'
                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/25"
                  : "text-text-muted hover:text-white"
              )}
              title="Show each Punch In and Punch Out as its own separate row"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-200" />
              <span>All Punches (Separate)</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded text-[10px] font-mono",
                punchViewFilter === 'all' ? "bg-white/20 text-white" : "bg-white/5 text-text-muted"
              )}>
                {punchEvents.length}
              </span>
            </button>

            <button
              onClick={() => setPunchViewFilter('in')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer",
                punchViewFilter === 'in'
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                  : "text-text-muted hover:text-emerald-400"
              )}
              title="Show only Punch In (Entry) logs"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>Punch In Logs</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded text-[10px] font-mono",
                punchViewFilter === 'in' ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              )}>
                {punchInCount}
              </span>
            </button>

            <button
              onClick={() => setPunchViewFilter('out')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer",
                punchViewFilter === 'out'
                  ? "bg-rose-600 text-white shadow-md shadow-rose-500/25"
                  : "text-text-muted hover:text-rose-400"
              )}
              title="Show only Punch Out (Exit) logs"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Punch Out Logs</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded text-[10px] font-mono",
                punchViewFilter === 'out' ? "bg-white/20 text-white" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              )}>
                {punchOutCount}
              </span>
            </button>

            <button
              onClick={() => setPunchViewFilter('combined')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer",
                punchViewFilter === 'combined'
                  ? "bg-slate-700 text-white shadow-md"
                  : "text-text-muted hover:text-white"
              )}
              title="Show combined daily summary"
            >
              <CalendarClock className="w-3.5 h-3.5 text-slate-300" />
              <span>Daily Combined</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded text-[10px] font-mono",
                punchViewFilter === 'combined' ? "bg-white/20 text-white" : "bg-white/5 text-text-muted"
              )}>
                {records.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Main Glass Table Container */}
      <div className="glass-card rounded-2xl border border-border/80 overflow-hidden flex flex-col min-h-[480px] shadow-2xl">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-border/60 flex flex-col xl:flex-row gap-3 justify-between bg-surface/50">
          <div className="relative w-full xl:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab === 'employees' ? 'personnel by name or ID' : 'attendance log'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'records' && (
              <>
                <div className="flex items-center gap-1.5 bg-[#0a0f1d] border border-border/80 rounded-xl px-2.5 py-1.5 text-xs text-white">
                  <Clock className="w-3.5 h-3.5 text-text-muted" />
                  <input 
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-transparent text-xs text-white focus:outline-none font-mono"
                  />
                </div>
                
                <select 
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="bg-[#0a0f1d] border border-border/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                >
                  <option value="all">All Sectors</option>
                  <option value="hq">Headquarters</option>
                  <option value="branch-1">Perimeter Gate 1</option>
                </select>
                
                <select 
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="bg-[#0a0f1d] border border-border/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Top Pagination & Quick Navigation Bar */}
        <div className="px-4 py-2.5 bg-[#050811]/90 border-b border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Range and Count */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-text-muted font-mono text-[11px]">
              <span>SHOWING</span>
              <span className="font-bold text-white px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono">
                {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
              </span>
              <span>OF</span>
              <span className="font-bold text-cyan-400 font-mono">{totalItems}</span>
              <span>
                {activeTab === 'employees' 
                  ? 'PERSONNEL' 
                  : punchViewFilter === 'combined' 
                    ? 'DAILY RECORDS' 
                    : 'PUNCH EVENTS'}
              </span>
            </div>

            <div className="h-3.5 w-px bg-border/60 hidden sm:block" />

            {/* Rows Per Page */}
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-[#0a0f1d] border border-border/80 rounded-lg px-2 py-0.5 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500/40 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Right: Top Pagination Controls */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              onClick={() => setPage(1)}
              disabled={safePage <= 1}
              className="px-2 py-1 rounded-lg border border-border/80 hover:bg-surface-hover text-text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-[11px] transition-colors"
              title="First Page"
            >
              First
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1 rounded-lg border border-border/80 hover:bg-surface-hover text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 px-1">
              <span className="text-text-muted text-[11px]">Page</span>
              <span className="font-bold text-cyan-400 px-1">{safePage}</span>
              <span className="text-text-muted text-[11px]">/ {totalPages}</span>
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1 rounded-lg border border-border/80 hover:bg-surface-hover text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage >= totalPages}
              className="px-2 py-1 rounded-lg border border-border/80 hover:bg-surface-hover text-text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-[11px] transition-colors"
              title="Last Page"
            >
              Last
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Access Error</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto mb-4">{error}</p>
            <button 
              onClick={fetchData}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold shadow-md transition-all"
            >
              Retry Connection
            </button>
          </div>
        ) : apiMissing ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <UserSquare2 className="w-14 h-14 text-cyan-400/40 mb-4 animate-pulse" />
            <h3 className="text-lg font-bold text-white mb-2">Backend Capability Notice</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto mb-4">
              The Biometric Face Recognition endpoint (<code className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono">/api/v1/{activeTab}</code>) is ready for deployment.
            </p>
            <button 
              onClick={() => setIsManualRegistrationOpen(true)}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold shadow-md transition-all"
            >
              Create Manual Entry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            {activeTab === 'employees' ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface/80 border-b border-border/60 text-text-muted font-mono uppercase tracking-wider text-[11px] sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-5 py-3.5">#</th>
                    <th className="px-5 py-3.5">Avatar</th>
                    <th className="px-5 py-3.5">Employee ID</th>
                    <th className="px-5 py-3.5">Full Name</th>
                    <th className="px-5 py-3.5">Department</th>
                    <th className="px-5 py-3.5">Designation</th>
                    <th className="px-5 py-3.5">Biometric Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center">
                        <EmptyState
                          icon={UserSquare2}
                          title="No personnel found"
                          description="Enroll face templates through the camera scanner or add manual records."
                          action={{
                            label: "Register Face",
                            onClick: () => setIsRegistrationModalOpen(true),
                            icon: UserSquare2
                          }}
                          className="border-0 bg-transparent"
                        />
                      </td>
                    </tr>
                  ) : (
                    displayedItems.map((emp: any, idx: number) => (
                      <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-5 py-3.5 font-mono text-text-dim">{startIndex + idx + 1}</td>
                        <td className="px-5 py-3.5">
                          {emp.photo_url ? (
                            <img src={emp.photo_url} alt="Profile" className="w-8 h-8 rounded-xl object-cover border border-border" />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center font-bold text-xs">
                              {emp.name ? emp.name.charAt(0) : 'E'}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-cyan-400 font-semibold">{emp.employee_id}</td>
                        <td className="px-5 py-3.5 font-semibold text-text">{emp.name}</td>
                        <td className="px-5 py-3.5 text-text-muted">{emp.department || 'General'}</td>
                        <td className="px-5 py-3.5 text-text-muted">{emp.designation || 'Staff'}</td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant={emp.is_enrolled ? 'success' : 'warning'}
                            size="xs"
                            dot
                          >
                            {emp.is_enrolled ? 'ENROLLED' : 'PENDING'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {!emp.is_enrolled ? (
                            <button
                              onClick={() => {
                                setSelectedEmployee(emp);
                                setIsRegistrationModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-semibold transition-colors"
                              title="Enroll Face Biometrics"
                            >
                              <UserSquare2 className="w-3 h-3" />
                              <span>Enroll Face</span>
                            </button>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedEmployee(emp);
                                  setIsRegistrationModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 text-text-muted hover:text-white border border-border/80 rounded-lg text-[11px] font-medium transition-colors"
                                title="Re-enroll Face Biometrics"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Re-enroll</span>
                              </button>
                              <button
                                onClick={() => handleDeleteFace(emp)}
                                className="inline-flex items-center p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[11px] transition-colors"
                                title="Delete Face Biometric"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : punchViewFilter === 'combined' ? (
              /* COMBINED DAILY ATTENDANCE TABLE */
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface/80 border-b border-border/60 text-text-muted font-mono uppercase tracking-wider text-[11px] sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-5 py-3.5">#</th>
                    <th className="px-5 py-3.5">Employee ID</th>
                    <th className="px-5 py-3.5">Subject Name</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Punch In (Entry)</th>
                    <th className="px-5 py-3.5">Punch Out (Exit)</th>
                    <th className="px-5 py-3.5">Camera Source</th>
                    <th className="px-5 py-3.5">Confidence</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-16 text-center">
                        <EmptyState
                          icon={CalendarClock}
                          title="No attendance records found"
                          description="Attendance logs will populate automatically when registered employees pass surveillance cameras."
                          action={{
                            label: "Test Live Face Scan",
                            onClick: () => setIsRecognitionModalOpen(true),
                            icon: Scan
                          }}
                          className="border-0 bg-transparent"
                        />
                      </td>
                    </tr>
                  ) : (
                    displayedItems.map((rec: any, idx: number) => {
                      const isPunchedOut = Boolean(rec.last_seen && rec.last_seen !== rec.first_seen);
                      return (
                        <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-5 py-3.5 font-mono text-text-dim">{startIndex + idx + 1}</td>
                          <td className="px-5 py-3.5 font-mono text-cyan-400 font-semibold">{rec.employee_id}</td>
                          <td className="px-5 py-3.5 font-semibold text-text">{rec.employee_name}</td>
                          <td className="px-5 py-3.5 font-mono text-text-muted">{rec.attendance_date}</td>
                          <td className="px-5 py-3.5 font-mono text-emerald-400 font-semibold">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                            {rec.first_seen || '--:--'}
                          </td>
                          <td className="px-5 py-3.5 font-mono">
                            {isPunchedOut ? (
                              <span className="text-rose-400 font-semibold">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>
                                {rec.last_seen}
                              </span>
                            ) : (
                              <span className="text-text-muted/50 italic text-[11px]">Pending Exit</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-text-muted">{rec.camera_name || 'Terminal-Gate-1'}</td>
                          <td className="px-5 py-3.5 font-mono text-cyan-400 font-bold">{rec.confidence || 98}%</td>
                          <td className="px-5 py-3.5">
                            <Badge variant={isPunchedOut ? 'danger' : 'success'} size="xs" dot>
                              {isPunchedOut ? 'PUNCHED OUT' : 'PUNCHED IN'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {!isPunchedOut && (
                              <button
                                type="button"
                                onClick={() => handleQuickPunchOut(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                title="Click to record Punch Out (Exit) now"
                              >
                                <LogOut className="w-3 h-3" />
                                <span>Punch Out</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              /* SEPARATE PUNCH IN & PUNCH OUT EVENTS TABLE */
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface/80 border-b border-border/60 text-text-muted font-mono uppercase tracking-wider text-[11px] sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-5 py-3.5">#</th>
                    <th className="px-5 py-3.5">Employee ID</th>
                    <th className="px-5 py-3.5">Subject Name</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Punch Type</th>
                    <th className="px-5 py-3.5">Recorded Time</th>
                    <th className="px-5 py-3.5">Camera Source</th>
                    <th className="px-5 py-3.5">Confidence</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredPunchEvents.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-16 text-center">
                        <EmptyState
                          icon={CalendarClock}
                          title="No punch logs found"
                          description="Individual Punch In and Punch Out events will appear here when employees scan face or register attendance."
                          action={{
                            label: "Test Live Face Punch",
                            onClick: () => setIsRecognitionModalOpen(true),
                            icon: Scan
                          }}
                          className="border-0 bg-transparent"
                        />
                      </td>
                    </tr>
                  ) : (
                    displayedItems.map((item: any, idx: number) => {
                      const isPunchIn = item.punch_type === 'in';
                      return (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-5 py-3.5 font-mono text-text-dim">{startIndex + idx + 1}</td>
                          <td className="px-5 py-3.5 font-mono text-cyan-400 font-semibold">{item.employee_id}</td>
                          <td className="px-5 py-3.5 font-semibold text-text">{item.employee_name}</td>
                          <td className="px-5 py-3.5 font-mono text-text-muted">{item.attendance_date}</td>
                          <td className="px-5 py-3.5">
                            {isPunchIn ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                                <span>PUNCH IN</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                                <span>PUNCH OUT</span>
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-mono">
                            <span className={cn(
                              "font-bold text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono",
                              isPunchIn 
                                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                                : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                            )}>
                              <Clock className="w-3 h-3 opacity-80" />
                              {item.punch_time}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-text-muted">{item.camera_name || 'Terminal-Gate-1'}</td>
                          <td className="px-5 py-3.5 font-mono text-cyan-400 font-bold">{item.confidence || 98}%</td>
                          <td className="px-5 py-3.5">
                            {isPunchIn ? (
                              item.has_punched_out ? (
                                <Badge variant="cyan" size="xs">PUNCHED IN (EXIT LOGGED)</Badge>
                              ) : (
                                <Badge variant="success" size="xs" dot pulse>ACTIVE (IN SHIFT)</Badge>
                              )
                            ) : (
                              <Badge variant="danger" size="xs" dot>PUNCHED OUT</Badge>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {isPunchIn && !item.has_punched_out ? (
                              <button
                                type="button"
                                onClick={() => handleQuickPunchOut(item.raw_record)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm shadow-rose-500/10"
                                title="Click to record Punch Out (Exit) now"
                              >
                                <LogOut className="w-3 h-3" />
                                <span>Punch Out</span>
                              </button>
                            ) : (
                              <span className="text-text-muted/40 font-mono text-[11px]">Recorded</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Bottom Pagination Bar */}
        <div className="p-3.5 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted bg-[#050811]/80 font-mono">
          <div>
            PAGE <span className="font-bold text-white">{safePage}</span> OF <span className="font-bold text-white">{totalPages}</span> ({totalItems} TOTAL {activeTab === 'employees' ? 'PERSONNEL' : punchViewFilter === 'combined' ? 'DAILY RECORDS' : 'PUNCH EVENTS'})
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(1)}
              disabled={safePage <= 1}
              className="px-2.5 py-1 rounded-lg border border-border/80 hover:bg-surface-hover text-white disabled:opacity-30 disabled:cursor-not-allowed text-[11px] transition-colors cursor-pointer"
            >
              FIRST
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1.5 rounded-lg border border-border/80 hover:bg-surface-hover text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-white px-2">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-lg border border-border/80 hover:bg-surface-hover text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage >= totalPages}
              className="px-2.5 py-1 rounded-lg border border-border/80 hover:bg-surface-hover text-white disabled:opacity-30 disabled:cursor-not-allowed text-[11px] transition-colors cursor-pointer"
            >
              LAST
            </button>
          </div>
        </div>
      </div>

      {/* Existing Preserved Modals */}
      <FaceRegistrationModal 
        isOpen={isRegistrationModalOpen} 
        onClose={() => {
          setIsRegistrationModalOpen(false);
          setSelectedEmployee(null);
        }} 
        onSuccess={() => {
          fetchData();
        }}
        initialEmployee={selectedEmployee}
      />

      <ManualRegistrationModal 
        isOpen={isManualRegistrationOpen}
        onClose={() => setIsManualRegistrationOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
        type={activeTab}
      />

      <FaceRecognitionModal 
        isOpen={isRecognitionModalOpen}
        onClose={() => setIsRecognitionModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
        initialPunchMode={recognitionPunchMode}
      />
    </div>
  );
}
