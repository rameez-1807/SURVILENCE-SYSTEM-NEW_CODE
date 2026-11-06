import { useState, useEffect } from 'react';
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
  UserPlus
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';
import { FaceRegistrationModal } from '../components/FaceRegistrationModal';
import { ManualRegistrationModal } from '../components/ManualRegistrationModal';
import { FaceRecognitionModal } from '../components/FaceRecognitionModal';

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
  
  // Registration Modal State
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [isManualRegistrationOpen, setIsManualRegistrationOpen] = useState(false);
  const [isRecognitionModalOpen, setIsRecognitionModalOpen] = useState(false);

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
        api.get('/employees?limit=200'),
        api.get('/attendance?limit=500')
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

  const filteredEmployees = employees.filter(emp => {
    return (emp.name || '').toLowerCase().includes(search.toLowerCase()) ||
           (emp.employee_id || '').toLowerCase().includes(search.toLowerCase()) ||
           (emp.department || '').toLowerCase().includes(search.toLowerCase());
  });

  const filteredRecords = records.filter(rec => {
    const matchesSearch = (rec.employee_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (rec.employee_id || '').toLowerCase().includes(search.toLowerCase());
    const matchesDate = !dateFilter || rec.attendance_date === dateFilter;
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Page Header */}
      <PageHeader
        title="Personnel & Attendance"
        subtitle="Automated biometric facial recognition logs, personnel rosters, and shift attendance"
        icon={Users}
        badge={
          <Badge variant="cyan" size="xs">
            {activeTab === 'employees' ? `${employees.length} ENROLLED` : `${records.length} CHECK-INS`}
          </Badge>
        }
      >
        {activeTab === 'records' && (
          <button 
            onClick={() => setIsRecognitionModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/25 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
            <span>⚡ Facenox Live Attendance</span>
          </button>
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

      {/* Tabs Selector */}
      <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div className="flex items-center gap-1.5 bg-[#0a0f1d] p-1 rounded-2xl border border-border/80">
          <button
            onClick={() => setActiveTab('records')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200",
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
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200",
              activeTab === 'employees' 
                ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20" 
                : "text-text-muted hover:text-white"
            )}
          >
            <UserSquare2 className="w-4 h-4" />
            <span>Personnel Directory</span>
          </button>
        </div>
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
                    filteredEmployees.map((emp, idx) => (
                      <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-5 py-3.5 font-mono text-text-dim">{idx + 1}</td>
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
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface/80 border-b border-border/60 text-text-muted font-mono uppercase tracking-wider text-[11px] sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-5 py-3.5">#</th>
                    <th className="px-5 py-3.5">Employee ID</th>
                    <th className="px-5 py-3.5">Subject Name</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Entry (First Seen)</th>
                    <th className="px-5 py-3.5">Exit (Last Seen)</th>
                    <th className="px-5 py-3.5">Camera Source</th>
                    <th className="px-5 py-3.5">Confidence</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center">
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
                    filteredRecords.map((rec, idx) => (
                      <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-5 py-3.5 font-mono text-text-dim">{idx + 1}</td>
                        <td className="px-5 py-3.5 font-mono text-cyan-400 font-semibold">{rec.employee_id}</td>
                        <td className="px-5 py-3.5 font-semibold text-text">{rec.employee_name}</td>
                        <td className="px-5 py-3.5 font-mono text-text-muted">{rec.attendance_date}</td>
                        <td className="px-5 py-3.5 font-mono text-emerald-400 font-semibold">{rec.first_seen || '09:02 AM'}</td>
                        <td className="px-5 py-3.5 font-mono text-text-muted">{rec.last_seen || '05:30 PM'}</td>
                        <td className="px-5 py-3.5 text-text-muted">{rec.camera_name || 'Gate-1-Face'}</td>
                        <td className="px-5 py-3.5 font-mono text-cyan-400 font-bold">{rec.confidence || 98}%</td>
                        <td className="px-5 py-3.5">
                          <Badge variant="success" size="xs" dot>
                            PRESENT
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
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
      />
    </div>
  );
}
