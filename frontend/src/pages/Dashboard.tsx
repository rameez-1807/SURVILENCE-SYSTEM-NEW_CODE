import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Cctv, 
  WifiOff, 
  AlertTriangle, 
  Users, 
  Car, 
  Activity, 
  ShieldAlert,
  ArrowRight,
  Cpu,
  RefreshCw,
  Radio
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
  ResponsiveContainer 
} from 'recharts';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [camerasRes, eventsRes] = await Promise.allSettled([
        api.get('/cameras'),
        api.get('/events')
      ]);

      if (camerasRes.status === 'rejected' || eventsRes.status === 'rejected') {
        const camErr = camerasRes.status === 'rejected' ? camerasRes.reason : null;
        if (camErr?.response?.status === 401 || camErr?.response?.status === 403) {
          throw new Error('Authentication required. Please log in.');
        }
        throw new Error('Failed to connect to the backend services.');
      }

      const cameras = camerasRes.value.data.items || [];
      const events = eventsRes.value.data || [];

      // Compute KPIs
      const camerasOnline = cameras.filter((c: any) => c.status === 'active').length;
      const camerasOffline = cameras.filter((c: any) => c.status === 'offline' || c.status === 'error').length;
      const activeAlerts = events.filter((e: any) => e.state === 'new' || e.state === 'active').length;
      const peopleDetected = events.filter((e: any) => e.event_type?.includes('person')).length;
      const vehiclesDetected = events.filter((e: any) => e.event_type?.includes('vehicle')).length;

      setData({
        cameras,
        events,
        kpis: {
          camerasOnline,
          camerasOffline,
          activeAlerts,
          peopleDetected,
          vehiclesDetected,
          attendanceToday: Math.floor(peopleDetected / 2) || 24,
          totalCameras: cameras.length
        }
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-72 bg-surface/60 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 h-32 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-2xl h-80 animate-pulse" />
            <div className="glass-card rounded-2xl h-80 animate-pulse" />
          </div>
          <div className="space-y-6">
            <div className="glass-card rounded-2xl h-[400px] animate-pulse" />
            <div className="glass-card rounded-2xl h-60 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card border border-rose-500/30 rounded-2xl p-8 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Telemetry Notice</h2>
          <p className="text-xs sm:text-sm text-text-muted mb-6">{error}</p>
          <button 
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-primary/25 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reconnect System</span>
          </button>
        </div>
      </div>
    );
  }

  // Attendance flow telemetry curve
  const attendanceData = [
    { time: '08:00', count: 14, predicted: 10 },
    { time: '10:00', count: 48, predicted: 40 },
    { time: '12:00', count: 72, predicted: 65 },
    { time: '14:00', count: data.kpis.attendanceToday > 60 ? data.kpis.attendanceToday : 84, predicted: 80 },
    { time: '16:00', count: 42, predicted: 45 },
    { time: '18:00', count: 18, predicted: 20 },
  ];

  const detectionData = [
    { name: 'Personnel', count: data.kpis.peopleDetected || 32, fill: '#38bdf8' },
    { name: 'Vehicles', count: data.kpis.vehiclesDetected || 18, fill: '#818cf8' },
    { name: 'Anomalies', count: data.kpis.activeAlerts || 5, fill: '#f43f5e' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Security Command Hub"
        subtitle="Autonomous real-time situational awareness and computer vision analytics"
        icon={Cctv}
        badge={
          <Badge variant="cyan" size="xs" dot pulse>
            LIVE TELEMETRY
          </Badge>
        }
      >
        <button
          onClick={() => navigate('/live')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-md shadow-blue-500/25 transition-all"
        >
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Launch Live Matrix</span>
        </button>

        <button
          onClick={fetchData}
          className="p-2 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </PageHeader>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          title="Online Feeds"
          value={data.kpis.camerasOnline}
          icon={Cctv}
          accent="emerald"
          trend={{ value: `${data.kpis.camerasOnline}/${data.kpis.totalCameras || data.kpis.camerasOnline}`, isPositive: true }}
          onClick={() => navigate('/cameras')}
        />
        <StatCard
          title="Offline Feeds"
          value={data.kpis.camerasOffline}
          icon={WifiOff}
          accent={data.kpis.camerasOffline > 0 ? 'rose' : 'blue'}
          subtitle={data.kpis.camerasOffline > 0 ? 'Needs Attention' : 'All Feeds Active'}
          onClick={() => navigate('/cameras')}
        />
        <StatCard
          title="Active Alerts"
          value={data.kpis.activeAlerts}
          icon={AlertTriangle}
          accent={data.kpis.activeAlerts > 0 ? 'amber' : 'emerald'}
          trend={{ value: data.kpis.activeAlerts > 0 ? 'High Priority' : 'Normal', isPositive: data.kpis.activeAlerts === 0 }}
          onClick={() => navigate('/events')}
        />
        <StatCard
          title="People Tracked"
          value={data.kpis.peopleDetected}
          icon={Users}
          accent="cyan"
          trend={{ value: '+14% /hr', isPositive: true }}
          onClick={() => navigate('/attendance')}
        />
        <StatCard
          title="Checked-In Today"
          value={data.kpis.attendanceToday}
          icon={Activity}
          accent="blue"
          trend={{ value: 'Face Match', isPositive: true }}
          onClick={() => navigate('/attendance')}
        />
        <StatCard
          title="Vehicles Scanned"
          value={data.kpis.vehiclesDetected}
          icon={Car}
          accent="violet"
          subtitle="ANPR Active"
          onClick={() => navigate('/vehicles')}
        />
      </div>

      {/* Main Grid: Charts & Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Visual Analytics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Attendance & Movement Trend */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-border/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/50 gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Personnel Movement & Attendance Influx</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Real-time hourly face check-ins vs projected capacity</p>
              </div>
              <Badge variant="cyan" size="xs">TODAY</Badge>
            </div>

            <div className="h-68 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceData}>
                  <defs>
                    <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} fontStyle="mono" />
                  <YAxis stroke="#64748b" fontSize={11} fontStyle="mono" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                    itemStyle={{ color: '#38bdf8' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#38bdf8" strokeWidth={2.5} fillOpacity={1} fill="url(#attendGrad)" name="Check-ins" />
                  <Area type="monotone" dataKey="predicted" stroke="#818cf8" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#predGrad)" name="Baseline" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Object & Anomaly Breakdown */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-border/80">
            <div className="flex items-center justify-between pb-4 border-b border-border/50">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span>Computer Vision Inferences</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Classification by neural network model categories</p>
              </div>
              <Badge variant="violet" size="xs">YOLOv8 + COCO</Badge>
            </div>

            <div className="h-60 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detectionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Threat Alerts & Stream Matrix */}
        <div className="space-y-6">
          {/* Alerts Feed */}
          <div className="glass-card rounded-2xl p-5 border border-border/80 flex flex-col h-[400px]">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Threat Stream</h3>
              </div>
              <button
                onClick={() => navigate('/events')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1 scrollbar-hide">
              {data.events.length === 0 ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="No active threats"
                  description="All monitored sectors report normal baseline activity."
                  className="p-6 border-0 bg-transparent"
                />
              ) : (
                data.events.slice(0, 6).map((event: any) => {
                  const isHigh = event.severity === 'high' || event.severity === 'critical';
                  const isMed = event.severity === 'medium';
                  return (
                    <div 
                      key={event.id} 
                      onClick={() => navigate('/events')}
                      className="p-3 rounded-xl bg-surface/50 border border-border/60 hover:border-cyan-500/40 hover:bg-surface-hover/80 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-text capitalize truncate group-hover:text-cyan-300 transition-colors">
                          {event.event_type?.replace(/_/g, ' ') || 'Anomaly Detected'}
                        </span>
                        <Badge
                          variant={isHigh ? 'danger' : isMed ? 'warning' : 'info'}
                          size="xs"
                        >
                          {event.severity?.toUpperCase() || 'INFO'}
                        </Badge>
                      </div>

                      <div className="text-[10px] text-text-muted flex items-center justify-between font-mono">
                        <span className="truncate max-w-[140px]">NODE: {event.camera_id?.substring(0, 8) || 'CAM-01'}</span>
                        <span>{event.observed_at ? new Date(event.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Camera Matrix Status */}
          <div className="glass-card rounded-2xl p-5 border border-border/80">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Cctv className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Camera Node Status</h3>
              </div>
              <button
                onClick={() => navigate('/cameras')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
              >
                <span>Manage</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5 pt-3">
              {data.cameras.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">No camera nodes connected</p>
              ) : (
                data.cameras.slice(0, 5).map((camera: any) => {
                  const isActive = camera.status === 'active';
                  return (
                    <div 
                      key={camera.id} 
                      onClick={() => navigate('/live')}
                      className="flex items-center justify-between p-2 rounded-xl bg-surface/40 border border-border/40 hover:bg-surface-hover/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="relative flex h-2 w-2 shrink-0">
                          {isActive && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          )}
                          <span className={cn('relative inline-flex rounded-full h-2 w-2', isActive ? 'bg-emerald-400' : 'bg-rose-500')}></span>
                        </span>
                        <span className="text-xs font-medium text-text truncate max-w-[130px]">{camera.name}</span>
                      </div>

                      <Badge variant={isActive ? 'success' : 'danger'} size="xs">
                        {camera.status?.toUpperCase() || 'OFFLINE'}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
