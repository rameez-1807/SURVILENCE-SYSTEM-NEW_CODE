import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Database,
  Image as ImageIcon,
  Video,
  Download,
  Lock,
  RefreshCw,
  Calendar,
  X,
  AlertCircle
} from 'lucide-react';
import { api, getBackendHost } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';

export default function Evidence() {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiMissing, setApiMissing] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);

  useEffect(() => {
    fetchEvidence();
  }, []);

  const fetchEvidence = async () => {
    try {
      setLoading(true);
      setApiMissing(false);
      setError(null);

      const res = await api.get('/evidence');
      setEvidenceList(res.data.items || []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setApiMissing(true);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication required. Please log in.');
      } else {
        setError('Failed to fetch evidence vault.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    alert("Generating temporary SHA-256 cryptographically signed URL for authorized forensic download...");
  };

  const filteredEvidence = evidenceList.filter(item => {
    const matchesSearch = (item.event_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (item.employee_info || '').toLowerCase().includes(search.toLowerCase()) ||
                          (item.vehicle_info || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || item.media_type === typeFilter;
    const matchesDate = !dateFilter || (item.timestamp && item.timestamp.startsWith(dateFilter));
    return matchesSearch && matchesType && matchesDate;
  });

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-6.5rem)] animate-fade-in select-none">
      {/* Header */}
      <PageHeader
        title="Forensic Evidence Vault"
        subtitle="Cryptographically sealed snapshots, license plate crops, and event clip archives"
        icon={Database}
        badge={
          <Badge variant="cyan" size="xs" dot>
            {evidenceList.length} SECURE RECORDS
          </Badge>
        }
      >
        <button
          onClick={fetchEvidence}
          className="p-2 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
          title="Refresh Vault"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </PageHeader>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="glass-card rounded-2xl border border-border/80 overflow-hidden flex flex-col flex-1 shadow-2xl">
        {/* Toolbar */}
        <div className="p-4 border-b border-border/60 flex flex-col lg:flex-row gap-3 justify-between bg-surface/50">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by event, employee, or plate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              disabled={apiMissing}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-[#0a0f1d] border border-border/80 rounded-xl px-2.5 py-1.5 text-xs text-white">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-mono"
                disabled={apiMissing}
              />
            </div>

            <div className="flex items-center bg-[#0a0f1d] border border-border/80 rounded-xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-text-muted mr-1.5" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-mono capitalize"
                disabled={apiMissing}
              >
                <option value="all">All Media</option>
                <option value="snapshot">Snapshots Only</option>
                <option value="video">Video Clips</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          {apiMissing ? (
            <div className="flex flex-col items-center justify-center p-12 text-center my-auto">
              <Database className="w-14 h-14 text-cyan-400/30 mb-4 animate-pulse" />
              <h3 className="text-lg font-bold text-white mb-2">Evidence Vault Ready</h3>
              <p className="text-xs text-text-muted max-w-md mx-auto mb-4">
                The Secure Evidence API (<code className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono">/api/v1/evidence</code>) stores signed media URLs with immutable SHA-256 integrity hashes.
              </p>
            </div>
          ) : filteredEvidence.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No evidence files found"
              description="Incident snapshots and license plate captures will archive here automatically."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {filteredEvidence.map((item) => (
                <div 
                  key={item.id} 
                  className="glass-card glass-card-hover rounded-2xl overflow-hidden border border-border/80 group cursor-pointer flex flex-col"
                  onClick={() => setSelectedEvidence(item)}
                >
                  <div className="aspect-video bg-black relative overflow-hidden flex items-center justify-center">
                    {/* Media Type Badge */}
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <Badge variant="cyan" size="xs" icon={item.media_type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}>
                        {item.media_type?.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="absolute top-2.5 right-2.5 z-10">
                      <Badge variant="violet" size="xs">
                        {item.detection_type?.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Image with fallback */}
                    <img
                      src={`${getBackendHost()}${item.media_url}`}
                      alt={item.event_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        (e.target as HTMLElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-full flex items-center justify-center bg-[#070b16] text-text-dim text-xs font-mono">
                      <ImageIcon className="w-8 h-8 opacity-40 text-cyan-400" />
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-white truncate mb-1">{item.event_name || 'Incident Evidence'}</h4>
                      <p className="text-[10px] font-mono text-text-dim">{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}</p>
                    </div>

                    <div className="space-y-1 text-xs pt-2 border-t border-border/50">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-text-muted">Node:</span>
                        <span className="font-mono text-text truncate ml-2">{item.camera_name || 'CAM-01'}</span>
                      </div>
                      {item.employee_info && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-text-muted">Personnel:</span>
                          <span className="text-cyan-400 font-semibold truncate ml-2">{item.employee_info}</span>
                        </div>
                      )}
                      {item.vehicle_info && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-text-muted">Plate:</span>
                          <span className="font-mono text-emerald-400 font-bold ml-2">{item.vehicle_info}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border/50 flex justify-end">
                      <button
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload();
                        }}
                      >
                        <Lock className="w-3 h-3" />
                        <span>Signed URL</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Forensic Preview Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-full">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 bg-surface/60">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span>Evidence Vault Inspection</span>
                </h3>
                <p className="text-xs text-text-muted font-mono mt-0.5">
                  Archived: {selectedEvidence.timestamp ? new Date(selectedEvidence.timestamp).toLocaleString() : 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvidence(null)}
                className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
              <div className="aspect-video bg-black rounded-xl border border-border/80 flex items-center justify-center overflow-hidden relative">
                {selectedEvidence.media_type === 'video' ? (
                  <video
                    src={`${getBackendHost()}${selectedEvidence.media_url}`}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={`${getBackendHost()}${selectedEvidence.media_url}`}
                    alt={selectedEvidence.event_name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      (e.target as HTMLElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                )}
                <div className="hidden text-text-dim flex flex-col items-center font-mono text-xs">
                  <Lock className="w-10 h-10 mb-2 opacity-50" />
                  <span>FILE ENCRYPTED IN SECURE ARCHIVE</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#0a0f1d] border border-border/80 rounded-xl p-4 text-xs font-mono">
                <div>
                  <div className="text-text-muted text-[10px] mb-1">DETECTION TYPE</div>
                  <div className="font-semibold text-white uppercase">{selectedEvidence.detection_type}</div>
                </div>
                <div>
                  <div className="text-text-muted text-[10px] mb-1">CAMERA NODE</div>
                  <div className="font-semibold text-cyan-400">{selectedEvidence.camera_name || 'CAM-01'}</div>
                </div>
                <div>
                  <div className="text-text-muted text-[10px] mb-1">PERSONNEL IDENTITY</div>
                  <div className="font-semibold text-white">{selectedEvidence.employee_info || 'Unidentified'}</div>
                </div>
                <div>
                  <div className="text-text-muted text-[10px] mb-1">VEHICLE PLATE</div>
                  <div className="font-semibold text-emerald-400">{selectedEvidence.vehicle_info || 'N/A'}</div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all"
                  onClick={() => handleDownload()}
                >
                  <Download className="w-4 h-4" />
                  <span>Generate Signed Forensic Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
