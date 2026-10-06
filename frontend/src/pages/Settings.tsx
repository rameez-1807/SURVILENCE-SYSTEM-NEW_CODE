import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Cpu, 
  Bell, 
  Save, 
  LogOut, 
  CheckCircle2, 
  Volume2, 
  Globe
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { cn } from '../utils/cn';

export default function Settings() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'security' | 'alerts'>('general');

  // Config States
  const [retentionDays, setRetentionDays] = useState('90');
  const [confidenceThreshold, setConfidenceThreshold] = useState('45');
  const [faceThreshold, setFaceThreshold] = useState('80');
  const [voiceVolume, setVoiceVolume] = useState('80');
  const [backendUrl, setBackendUrl] = useState('https://survilence-system-new-code.onrender.com');
  const [tenantId, setTenantId] = useState('bb398bec-8429-44db-b9ec-b04c3ac81c36');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(null as any), 3500);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Save Notification */}
      {saved && (
        <div className="fixed top-20 right-6 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 z-50 animate-slide-up shadow-2xl backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>System configuration parameters committed successfully</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Platform Configuration"
        subtitle="Manage neural surveillance parameters, API endpoints, and SOC operator preferences"
        icon={SettingsIcon}
        badge={
          <Badge variant="cyan" size="xs">
            ENTERPRISE v0.1.0
          </Badge>
        }
      >
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Terminate Session</span>
        </button>
      </PageHeader>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-[#0a0f1d] p-1 rounded-2xl border border-border/80 w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
            activeTab === 'general' ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-white"
          )}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>General</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
            activeTab === 'ai' ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-white"
          )}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>AI Vision Tuning</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
            activeTab === 'security' ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-white"
          )}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Security & API</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
            activeTab === 'alerts' ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-white"
          )}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Alert Channels</span>
        </button>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="glass-card rounded-2xl border border-border/80 p-6 sm:p-8 shadow-xl space-y-6">
        {activeTab === 'general' && (
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-border/60 pb-3">
              General Operations
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider font-mono mb-1.5">
                  Platform Identification
                </label>
                <input 
                  type="text" 
                  defaultValue="AEGIS AI Defense Command"
                  className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider font-mono mb-1.5">
                  Retention Policy (Days)
                </label>
                <input 
                  type="number" 
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider font-mono mb-1.5">
                  Timezone Standardization
                </label>
                <select className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono">
                  <option value="UTC">UTC (Universal Time Coordinated)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider font-mono mb-1.5">
                  Audio Speech Engine Volume
                </label>
                <div className="flex items-center gap-3 bg-[#0a0f1d] border border-border/80 rounded-xl px-3.5 py-2">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={voiceVolume} 
                    onChange={(e) => setVoiceVolume(e.target.value)}
                    className="flex-1 accent-cyan-500 cursor-pointer h-1.5"
                  />
                  <span className="font-mono text-xs text-cyan-400 min-w-[32px]">{voiceVolume}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-border/60 pb-3">
              Neural Computer Vision Thresholds
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-text uppercase tracking-wider font-mono">
                    Object Detection Sensitivity
                  </label>
                  <span className="text-xs font-mono text-cyan-400 font-bold">{confidenceThreshold}%</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="95" 
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(e.target.value)}
                  className="w-full accent-cyan-500 cursor-pointer h-2"
                />
                <p className="text-[11px] text-text-muted mt-1">Lower threshold triggers more detections; higher reduces false positives.</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-text uppercase tracking-wider font-mono">
                    Face Recognition Match Confidence
                  </label>
                  <span className="text-xs font-mono text-emerald-400 font-bold">{faceThreshold}%</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="99" 
                  value={faceThreshold}
                  onChange={(e) => setFaceThreshold(e.target.value)}
                  className="w-full accent-emerald-500 cursor-pointer h-2"
                />
                <p className="text-[11px] text-text-muted mt-1">Minimum similarity Euclidean score required to mark attendance.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-border/60 pb-3">
              API Gateways & Multi-Tenancy
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider font-mono mb-1.5">
                  FastAPI Cloud Server Endpoint
                </label>
                <input 
                  type="text" 
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-cyan-300 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider font-mono mb-1.5">
                  Multi-Tenant Identification Header (X-Tenant-ID)
                </label>
                <input 
                  type="text" 
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-border/60 pb-3">
              Security Operations Center Notifications
            </h3>

            <div className="space-y-3">
              {[
                { title: 'Critical Intrusion Alerts', desc: 'Broadcast audio alarm and priority toast on unauthorized zone entry', defaultChecked: true },
                { title: 'Unknown Person Warning', desc: 'Flag unidentified face biometrics to the triage review queue', defaultChecked: true },
                { title: 'ANPR Watchlist Hits', desc: 'Instant banner notification when a flagged license plate is detected', defaultChecked: true },
                { title: 'Camera Stream Disconnect Alerts', desc: 'Notify operators if RTSP FPS drops below threshold', defaultChecked: false },
              ].map((item, idx) => (
                <label key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-surface/40 border border-border/60 hover:bg-surface-hover/60 transition-colors cursor-pointer">
                  <input type="checkbox" defaultChecked={item.defaultChecked} className="mt-1 accent-cyan-500 rounded" />
                  <div>
                    <div className="text-xs font-semibold text-white">{item.title}</div>
                    <div className="text-[11px] text-text-muted">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border/60 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
}
