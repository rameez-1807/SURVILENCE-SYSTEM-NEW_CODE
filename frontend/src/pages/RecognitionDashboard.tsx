import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  CheckCircle2, 
  RefreshCw, 
  Filter, 
  Calendar, 
  Activity, 
  BarChart3, 
  Cctv, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { api } from '../lib/api';

interface DashboardStats {
  total_registered_employees: number;
  recognized_faces_today: number;
  unknown_faces_today: number;
  attendance_marked_today: number;
  trend_data: Array<{ time: string; recognized: number; unknown: number }>;
  distribution_data: Array<{ name: string; count: number; fill: string }>;
  recent_activity: Array<{
    id: string;
    employee_id?: string;
    employee_name?: string;
    confidence: number;
    camera_name: string;
    status: string;
    timestamp: string;
  }>;
}

export default function RecognitionDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Period & Filter state
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'custom'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      let query = `/recognition-history/stats?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        query += `&start_date=${startDate}&end_date=${endDate}`;
      }

      const res = await api.get(query);
      setStats(res.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to fetch recognition dashboard stats:', err);
      setError(err.response?.data?.detail || 'Could not load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  // Initial fetch and Period filter change listener
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 8-Second Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStats();
    }, 8000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  if (loading && !stats) {
    return (
      <div className="space-y-6 animate-pulse p-2">
        <div className="h-20 bg-surface border border-border rounded-2xl"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-surface border border-border rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-surface border border-border rounded-xl"></div>
          <div className="h-72 bg-surface border border-border rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">Face Recognition Dashboard</h1>
            <p className="text-xs text-text-muted">Real-time biometric analytics & facial surveillance activity</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Live Auto-Refresh Indicator */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
              autoRefresh 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-surface-hover border-border text-text-muted'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-text-muted'}`} />
            <span>{autoRefresh ? 'Live Sync Active (8s)' : 'Auto-Sync Paused'}</span>
          </button>

          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Period Filter Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Period Filter:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPeriod('today')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              period === 'today' ? 'bg-primary text-white shadow-sm' : 'bg-surface-hover hover:bg-border text-text-muted'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setPeriod('7days')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              period === '7days' ? 'bg-primary text-white shadow-sm' : 'bg-surface-hover hover:bg-border text-text-muted'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setPeriod('30days')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              period === '30days' ? 'bg-primary text-white shadow-sm' : 'bg-surface-hover hover:bg-border text-text-muted'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setPeriod('custom')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              period === 'custom' ? 'bg-primary text-white shadow-sm' : 'bg-surface-hover hover:bg-border text-text-muted'
            }`}
          >
            Custom Range
          </button>
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
            <Calendar className="w-4 h-4 text-text-muted" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-text-muted">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Registered Employees */}
        <div className="bg-surface p-5 rounded-xl border border-border flex flex-col justify-between h-32 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Total Registered Employees</span>
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-text">{stats?.total_registered_employees || 0}</div>
          <div className="text-[11px] text-text-muted">Enrolled SQLite profiles</div>
        </div>

        {/* Card 2: Faces Recognized Today */}
        <div className="bg-surface p-5 rounded-xl border border-border flex flex-col justify-between h-32 shadow-sm hover:border-emerald-500/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Faces Recognized Today</span>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-400">{stats?.recognized_faces_today || 0}</div>
          <div className="text-[11px] text-emerald-400/80 font-medium">Verified biometric matches</div>
        </div>

        {/* Card 3: Unknown Faces Today */}
        <div className="bg-surface p-5 rounded-xl border border-border flex flex-col justify-between h-32 shadow-sm hover:border-rose-500/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Unknown Faces Today</span>
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-rose-400">{stats?.unknown_faces_today || 0}</div>
          <div className="text-[11px] text-rose-400/80 font-medium">Unidentified faces detected</div>
        </div>

        {/* Card 4: Attendance Marked Today */}
        <div className="bg-surface p-5 rounded-xl border border-border flex flex-col justify-between h-32 shadow-sm hover:border-blue-500/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Attendance Marked Today</span>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-blue-400">{stats?.attendance_marked_today || 0}</div>
          <div className="text-[11px] text-text-muted">Unique daily check-ins</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Recognition Timeline Trend */}
        <div className="lg:col-span-2 bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Recognition Activity Timeline Trend
              </h3>
              <p className="text-xs text-text-muted">Timeline distribution of facial detection events over time</p>
            </div>
            <span className="text-[11px] text-text-muted font-mono">
              Last Sync: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>

          <div className="h-64 w-full">
            {stats && stats.trend_data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trend_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUnk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                  <XAxis dataKey="time" stroke="#71717A" fontSize={11} />
                  <YAxis stroke="#71717A" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC', borderRadius: '10px', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="recognized" stroke="#10B981" fillOpacity={1} fill="url(#colorRec)" name="Recognized" strokeWidth={2} />
                  <Area type="monotone" dataKey="unknown" stroke="#EF4444" fillOpacity={1} fill="url(#colorUnk)" name="Unknown" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs">
                <Clock className="w-8 h-8 opacity-30 mb-1" />
                <span>No recognition timeline data found.</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Identity Distribution (Recognized vs Unknown) */}
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              Recognized vs. Unknown Ratio
            </h3>
            <p className="text-xs text-text-muted">Biometric identity breakdown</p>
          </div>

          <div className="h-64 w-full">
            {stats && stats.distribution_data.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.distribution_data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717A" fontSize={11} />
                  <YAxis stroke="#71717A" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC', borderRadius: '10px', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.distribution_data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs">
                <UserX className="w-8 h-8 opacity-30 mb-1" />
                <span>No distribution activity recorded.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recognition Activity Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <div>
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Cctv className="w-4 h-4 text-primary" />
              Recent Recognition Activity
            </h3>
            <p className="text-xs text-text-muted">Real-time stream of detected face biometrics</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-hover/50 border-b border-border text-text-muted font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Employee Name</th>
                <th className="py-3.5 px-4">Employee ID</th>
                <th className="py-3.5 px-4">Time</th>
                <th className="py-3.5 px-4">Confidence</th>
                <th className="py-3.5 px-4">Camera Source</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {!stats || stats.recent_activity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-1.5">
                      <UserX className="w-8 h-8 opacity-40" />
                      <p className="font-semibold text-text">No recognition activity found.</p>
                      <p className="text-[11px]">Open live camera scanner to generate recognition activity.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                stats.recent_activity.map((act) => {
                  const dt = new Date(act.timestamp);
                  const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const isMatch = act.status === 'Recognized';

                  return (
                    <tr key={act.id} className="hover:bg-surface-hover/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-text">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isMatch ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                          {act.employee_name || 'Unknown Person'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-primary">
                        {act.employee_id || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-text-muted font-mono">{timeStr}</td>
                      <td className="py-3.5 px-4 font-semibold">
                        <span className={isMatch ? 'text-emerald-400' : 'text-rose-400'}>
                          {Math.round(act.confidence)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-text-muted">{act.camera_name}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isMatch 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isMatch ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {act.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
