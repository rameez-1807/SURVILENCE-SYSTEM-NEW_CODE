import { useState, useEffect } from 'react';
import { 
  Cctv, 
  WifiOff, 
  AlertTriangle, 
  Users, 
  Car, 
  Activity 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { api } from '../lib/api';
import { cn } from '../utils/cn';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // We catch errors per request to handle 401s gracefully
        const [camerasRes, eventsRes] = await Promise.allSettled([
          api.get('/cameras'),
          api.get('/events')
        ]);

        if (camerasRes.status === 'rejected' || eventsRes.status === 'rejected') {
          // If auth fails or backend is down
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
        const peopleDetected = events.filter((e: any) => e.event_type.includes('person')).length;
        const vehiclesDetected = events.filter((e: any) => e.event_type.includes('vehicle')).length;

        setData({
          cameras,
          events,
          kpis: {
            camerasOnline,
            camerasOffline,
            activeAlerts,
            peopleDetected,
            vehiclesDetected,
            attendanceToday: Math.floor(peopleDetected / 2) // Mock logic based on real events
          }
        });
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-5 h-32 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="w-24 h-4 bg-surface-hover rounded"></div>
                <div className="w-5 h-5 bg-surface-hover rounded-full"></div>
              </div>
              <div className="w-16 h-8 bg-surface-hover rounded mt-2"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface border border-border rounded-lg p-6 h-80"></div>
            <div className="bg-surface border border-border rounded-lg p-6 h-80"></div>
          </div>
          <div className="space-y-6">
            <div className="bg-surface border border-border rounded-lg p-6 h-[400px]"></div>
            <div className="bg-surface border border-border rounded-lg p-6 h-48"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="bg-surface border border-danger/50 rounded-lg p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text mb-2">Access Error</h2>
          <p className="text-text-muted">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Mock chart data based on event counts or static fallbacks if empty
  const attendanceData = [
    { time: '08:00', count: 12 },
    { time: '10:00', count: 45 },
    { time: '12:00', count: 68 },
    { time: '14:00', count: data.kpis.attendanceToday > 68 ? data.kpis.attendanceToday : 75 },
    { time: '16:00', count: 30 },
    { time: '18:00', count: 5 },
  ];

  const detectionData = [
    { name: 'People', count: data.kpis.peopleDetected || 10 },
    { name: 'Vehicles', count: data.kpis.vehiclesDetected || 5 },
    { name: 'Anomalies', count: data.kpis.activeAlerts || 2 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Cameras Online" value={data.kpis.camerasOnline} icon={Cctv} color="text-success" />
        <KpiCard title="Cameras Offline" value={data.kpis.camerasOffline} icon={WifiOff} color="text-danger" />
        <KpiCard title="Active Alerts" value={data.kpis.activeAlerts} icon={AlertTriangle} color="text-warning" />
        <KpiCard title="People Detected" value={data.kpis.peopleDetected} icon={Users} color="text-primary" />
        <KpiCard title="Attendance Today" value={data.kpis.attendanceToday} icon={Activity} color="text-primary" />
        <KpiCard title="Vehicles" value={data.kpis.vehiclesDetected} icon={Car} color="text-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-border rounded-lg p-6">
            <h3 className="text-lg font-medium text-text mb-4">Attendance Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="time" stroke="#a1a1aa" fontSize={12} />
                  <YAxis stroke="#a1a1aa" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#f4f4f5' }}
                    itemStyle={{ color: '#3b82f6' }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6">
            <h3 className="text-lg font-medium text-text mb-4">Object Detections Today</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detectionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                  <YAxis stroke="#a1a1aa" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#f4f4f5' }}
                    cursor={{ fill: '#27272a' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Side Panels */}
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-lg p-6 flex flex-col h-[400px]">
            <h3 className="text-lg font-medium text-text mb-4">Recent Alerts</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {data.events.length === 0 ? (
                <div className="text-center text-text-muted mt-10">No recent alerts</div>
              ) : (
                data.events.slice(0, 5).map((event: any) => (
                  <div key={event.id} className="p-3 bg-surface-hover rounded-md border border-border hover:border-border/80 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium text-text capitalize">{event.event_type.replace('_', ' ')}</span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        event.severity === 'high' ? 'bg-danger/20 text-danger' : 
                        event.severity === 'medium' ? 'bg-warning/20 text-warning' : 
                        'bg-primary/20 text-primary'
                      )}>
                        {event.severity}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted flex justify-between">
                      <span>Camera: {event.camera_id?.substring(0, 8)}</span>
                      <span>{new Date(event.observed_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6">
            <h3 className="text-lg font-medium text-text mb-4">Camera Health</h3>
            <div className="space-y-3">
              {data.cameras.length === 0 ? (
                <div className="text-center text-text-muted">No cameras connected</div>
              ) : (
                data.cameras.slice(0, 5).map((camera: any) => (
                  <div key={camera.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        camera.status === 'active' ? "bg-success" : "bg-danger"
                      )}></div>
                      <span className="text-sm text-text truncate w-32">{camera.name}</span>
                    </div>
                    <span className="text-xs text-text-muted capitalize">{camera.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between h-32 hover:border-border/80 transition-colors shadow-sm">
      <div className="flex justify-between items-start">
        <span className="text-sm font-medium text-text-muted">{title}</span>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div className="text-3xl font-bold text-text mt-2">{value}</div>
    </div>
  );
}
