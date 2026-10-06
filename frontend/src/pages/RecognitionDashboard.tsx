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
  Clock,
  Scan
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
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';

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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStats();
    }, 8000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="h-16 w-80 bg-surface/60 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-32 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card rounded-2xl h-80 animate-pulse" />
          <div className="glass-card rounded-2xl h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Header Banner */}
      <PageHeader
        title="Biometric Recognition Intelligence"
        subtitle="Real-time facial identification analytics, enrolled embeddings, and telemetry logs"
        icon={Scan}
        badge={
          <Badge variant="cyan" size="xs" dot pulse>
            NEURAL FACE ENGINE
          </Badge>
        }
      >
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all',
            autoRefresh 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/10' 
              : 'bg-surface/80 border-border/80 text-text-muted hover:text-white'
          )}
        >
          <span className={cn('w-2 h-2 rounded-full', autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-text-muted')} />
          <span>{autoRefresh ? 'Live Sync (8s)' : 'Sync Paused'}</span>
        </button>

        <button
          onClick={fetchStats}
          className="p-2 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </PageHeader>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Period Filter Bar */}
      <div className="glass-card p-3 sm:p-4 rounded-2xl border border-border/80 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-text-muted">Analysis Horizon:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['today', '7days', '30days', 'custom'] as const).map((p) => {
            const labels = { today: 'Today', '7days': 'Last 7 Days', '30days': 'Last 30 Days', custom: 'Custom Range' };
            const isActive = period === p;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200',
                  isActive 
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20' 
                    : 'bg-surface/60 hover:bg-surface-hover text-text-muted hover:text-white border border-border/60'
                )}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#0a0f1d] border border-border/80 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            />
            <span className="text-xs text-text-muted font-mono">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#0a0f1d] border border-border/80 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            />
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Registered Personnel"
          value={stats?.total_registered_employees || 0}
          icon={Users}
          accent="blue"
          subtitle="Enrolled Face Embeddings"
        />
        <StatCard
          title="Faces Verified Today"
          value={stats?.recognized_faces_today || 0}
          icon={UserCheck}
          accent="emerald"
          trend={{ value: 'Confidence > 85%', isPositive: true }}
        />
        <StatCard
          title="Unidentified Faces"
          value={stats?.unknown_faces_today || 0}
          icon={UserX}
          accent={stats && stats.unknown_faces_today > 0 ? 'rose' : 'cyan'}
          trend={{ value: stats?.unknown_faces_today || 0, isPositive: stats?.unknown_faces_today === 0, label: 'Unregistered' }}
        />
        <StatCard
          title="Attendance Logged"
          value={stats?.attendance_marked_today || 0}
          icon={CheckCircle2}
          accent="cyan"
          subtitle="Unique Daily Check-ins"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Recognition Activity Timeline Trend */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 sm:p-6 border border-border/80 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/50 gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Biometric Temporal Distribution</span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Chronological detection frequency of known vs unknown subjects</p>
            </div>
            <span className="text-[10px] text-text-dim font-mono">
              SYNC: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>

          <div className="h-68 w-full mt-4">
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} fontStyle="mono" />
                  <YAxis stroke="#64748b" fontSize={11} fontStyle="mono" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="recognized" stroke="#10b981" fillOpacity={1} fill="url(#colorRec)" name="Verified" strokeWidth={2} />
                  <Area type="monotone" dataKey="unknown" stroke="#ef4444" fillOpacity={1} fill="url(#colorUnk)" name="Unidentified" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-dim text-xs font-mono">
                <Clock className="w-8 h-8 opacity-30 mb-2" />
                <span>NO TEMPORAL BIOMETRIC TELEMETRY FOUND</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Identity Distribution */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 border border-border/80 flex flex-col justify-between">
          <div className="pb-4 border-b border-border/50">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Identity Ratio</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">Known vs Unknown biometric proportion</p>
          </div>

          <div className="h-68 w-full mt-4">
            {stats && stats.distribution_data.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.distribution_data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                    {stats.distribution_data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill || (index === 0 ? '#10b981' : '#f43f5e')} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-dim text-xs font-mono">
                <UserX className="w-8 h-8 opacity-30 mb-2" />
                <span>NO IDENTITY PROPORTIONS RECORDED</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recognition Activity Table */}
      <div className="glass-card rounded-2xl border border-border/80 overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between bg-surface/50">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Cctv className="w-4 h-4 text-cyan-400" />
              <span>Real-Time Biometric Inferences</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">High-frequency stream of detected face encodings</p>
          </div>
          <Badge variant="cyan" size="xs">
            LIVE FEED
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface/80 border-b border-border/60 text-text-muted font-mono uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Identifier</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Neural Confidence</th>
                <th className="py-3 px-4">Camera Source</th>
                <th className="py-3 px-4">Inference Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {!stats || stats.recent_activity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <EmptyState
                      icon={UserX}
                      title="No recognition activity found"
                      description="Deploy camera scanner or test webcam face recognition to generate live stream data."
                      className="border-0 bg-transparent"
                    />
                  </td>
                </tr>
              ) : (
                stats.recent_activity.map((act) => {
                  const dt = new Date(act.timestamp);
                  const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const isMatch = act.status === 'Recognized';

                  return (
                    <tr key={act.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-text">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('w-2 h-2 rounded-full', isMatch ? 'bg-emerald-400' : 'bg-rose-500')} />
                          <span className="truncate max-w-[150px]">{act.employee_name || 'Unknown Person'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-cyan-400">
                        {act.employee_id || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-text-muted font-mono">{timeStr}</td>
                      <td className="py-3.5 px-4 font-semibold font-mono">
                        <span className={isMatch ? 'text-emerald-400' : 'text-rose-400'}>
                          {Math.round(act.confidence)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-text-muted">{act.camera_name}</td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={isMatch ? 'success' : 'danger'}
                          size="xs"
                          dot
                        >
                          {act.status?.toUpperCase() || 'UNRECOGNIZED'}
                        </Badge>
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
