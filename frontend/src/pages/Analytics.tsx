import { useState } from 'react';
import { 
  BarChart3, 
  Activity, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  Download, 
  Layers
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
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { cn } from '../utils/cn';

const THROUGHPUT_DATA = [
  { time: '00:00', fps: 120, inferences: 840, latency: 22 },
  { time: '04:00', fps: 118, inferences: 620, latency: 19 },
  { time: '08:00', fps: 142, inferences: 1980, latency: 26 },
  { time: '12:00', fps: 145, inferences: 2840, latency: 28 },
  { time: '16:00', fps: 138, inferences: 2410, latency: 25 },
  { time: '20:00', fps: 128, inferences: 1450, latency: 23 },
  { time: '23:59', fps: 122, inferences: 920, latency: 20 },
];

const SECTOR_DISTRIBUTION = [
  { name: 'Perimeter Alpha', detections: 1420, fill: '#38bdf8' },
  { name: 'Gate 01 Access', detections: 2890, fill: '#818cf8' },
  { name: 'Vault Sector C', detections: 410, fill: '#f43f5e' },
  { name: 'Parking Bay B', detections: 1850, fill: '#10b981' },
  { name: 'Office Main Hall', detections: 3200, fill: '#fbbf24' },
];

const MODEL_ACCURACY_DATA = [
  { model: 'YOLOv8x (Detection)', precision: 96.4, recall: 94.2 },
  { model: 'FaceNet (Biometrics)', precision: 99.1, recall: 98.6 },
  { model: 'Tesseract OCR (Plates)', precision: 95.8, recall: 93.1 },
  { model: 'ByteTrack (Re-ID)', precision: 97.2, recall: 96.0 },
];

export default function Analytics() {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');

  const handleExport = () => {
    alert("Exporting Intelligence Analytics Dossier (PDF/CSV)...");
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Header */}
      <PageHeader
        title="Predictive Threat Analytics & Intelligence"
        subtitle="Computer vision inference performance, detection heat distribution, and edge pipeline metrics"
        icon={BarChart3}
        badge={
          <Badge variant="cyan" size="xs" dot pulse>
            TELEMETRY ACTIVE
          </Badge>
        }
      >
        <div className="flex items-center gap-1.5 bg-[#0a0f1d] p-1 rounded-xl border border-border/80">
          {(['24h', '7d', '30d'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all",
                timeframe === t 
                  ? "bg-primary text-white shadow-sm" 
                  : "text-text-muted hover:text-white"
              )}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/25 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Analytics Dossier</span>
        </button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Edge Neural Inferences"
          value="11,060"
          icon={Cpu}
          accent="cyan"
          trend={{ value: '+24.8%', isPositive: true, label: 'vs last window' }}
        />
        <StatCard
          title="Aggregate Pipeline FPS"
          value="142.4"
          icon={Zap}
          accent="emerald"
          subtitle="Real-time multi-stream throughput"
        />
        <StatCard
          title="Mean Inference Latency"
          value="24.2ms"
          icon={Activity}
          accent="violet"
          trend={{ value: '-3.8ms', isPositive: true, label: 'faster' }}
        />
        <StatCard
          title="Model Precision SLA"
          value="98.2%"
          icon={ShieldCheck}
          accent="blue"
          trend={{ value: 'Zero Drift', isPositive: true }}
        />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Inferences & Latency Curve */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 sm:p-6 border border-border/80 flex flex-col justify-between shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/50 gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Neural Inference Throughput & Latency</span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Real-time hourly processing load vs hardware inference latency</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                Inferences/hr
              </span>
              <span className="flex items-center gap-1.5 text-indigo-400">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                FPS
              </span>
            </div>
          </div>

          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={THROUGHPUT_DATA}>
                <defs>
                  <linearGradient id="infGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="fpsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} fontStyle="mono" />
                <YAxis stroke="#64748b" fontSize={11} fontStyle="mono" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="inferences" stroke="#38bdf8" strokeWidth={2.5} fillOpacity={1} fill="url(#infGrad)" name="Inferences" />
                <Area type="monotone" dataKey="fps" stroke="#818cf8" strokeWidth={1.5} fillOpacity={1} fill="url(#fpsGrad)" name="Aggregate FPS" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector Density Distribution */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 border border-border/80 flex flex-col justify-between shadow-xl">
          <div className="pb-4 border-b border-border/50">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Zone Detection Density</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">Anomaly concentration by perimeter zone</p>
          </div>

          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SECTOR_DISTRIBUTION} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={10} fontStyle="mono" />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={95} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                />
                <Bar dataKey="detections" radius={[0, 6, 6, 0]} barSize={22}>
                  {SECTOR_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Model Benchmark Precision & Recall Matrix */}
      <div className="glass-card rounded-2xl border border-border/80 overflow-hidden shadow-xl p-5 sm:p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/50 mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Model Benchmark & Validation Accuracy</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">Active weights precision, recall, and edge model efficiency</p>
          </div>
          <Badge variant="success" size="xs">ALL PASSED</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODEL_ACCURACY_DATA.map((item, idx) => (
            <div key={idx} className="bg-surface/50 border border-border/60 rounded-xl p-4 space-y-3">
              <div className="font-semibold text-xs text-white truncate">{item.model}</div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-text-muted mb-1">
                    <span>Precision</span>
                    <span className="text-cyan-400 font-bold">{item.precision}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: `${item.precision}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-text-muted mb-1">
                    <span>Recall</span>
                    <span className="text-emerald-400 font-bold">{item.recall}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-400" style={{ width: `${item.recall}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
