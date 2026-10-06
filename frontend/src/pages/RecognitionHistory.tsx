import { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  Cctv, 
  UserCheck, 
  UserX, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';

interface RecognitionRecord {
  id: string;
  employee_uuid?: string;
  employee_id?: string;
  employee_name?: string;
  confidence: number;
  camera_name: string;
  status: string;
  timestamp: string;
}

export default function RecognitionHistory() {
  const [records, setRecords] = useState<RecognitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [cameraFilter, setCameraFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (employeeSearch.trim()) params.append('employee', employeeSearch.trim());
      if (dateFilter) params.append('date', dateFilter);
      if (cameraFilter.trim()) params.append('camera', cameraFilter.trim());
      if (statusFilter) params.append('status', statusFilter);
      
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await api.get(`/recognition-history?${params.toString()}`);
      setRecords(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
    } catch (err: any) {
      console.error('Failed to fetch recognition history:', err);
      setError('Could not load recognition history. Please verify connection.');
    } finally {
      setLoading(false);
    }
  }, [employeeSearch, dateFilter, cameraFilter, statusFilter, page, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleResetFilters = () => {
    setEmployeeSearch('');
    setDateFilter('');
    setCameraFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const recognizedCount = records.filter(r => r.status === 'Recognized').length;
  const avgConfidence = records.length > 0
    ? Math.round(records.reduce((acc, curr) => acc + curr.confidence, 0) / records.length)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Header */}
      <PageHeader
        title="Biometric Recognition Audit Logs"
        subtitle="Forensic timestamped ledger of neural face matches and detection events"
        icon={History}
        badge={
          <Badge variant="cyan" size="xs">
            {total} TOTAL EVENTS
          </Badge>
        }
      >
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="p-2 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
          title="Refresh History"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Audit Trail Logs"
          value={total}
          icon={ShieldCheck}
          accent="blue"
          subtitle="Indexed Telemetry Rows"
        />
        <StatCard
          title="Verified Matches"
          value={recognizedCount}
          icon={UserCheck}
          accent="emerald"
          trend={{ value: `${records.length > 0 ? Math.round((recognizedCount / records.length) * 100) : 0}% Ratio`, isPositive: true }}
        />
        <StatCard
          title="Mean AI Confidence"
          value={`${avgConfidence}%`}
          icon={CheckCircle2}
          accent="cyan"
          subtitle="Euclidean Distance Match"
        />
        <StatCard
          title="Inference Feeds"
          value="Edge Vision"
          icon={Cctv}
          accent="violet"
          subtitle="Autonomous Stream Active"
        />
      </div>

      {/* Filter Control Bar */}
      <div className="glass-card p-4 rounded-2xl border border-border/80 space-y-3 shadow-md">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-text-muted">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <span>Audit Filters & Constraints</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search Name or Employee ID..."
              value={employeeSearch}
              onChange={(e) => { setEmployeeSearch(e.target.value); setPage(1); }}
              className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
            />
          </div>

          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
            />
          </div>

          <div className="relative">
            <Cctv className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Filter Camera Source..."
              value={cameraFilter}
              onChange={(e) => { setCameraFilter(e.target.value); setPage(1); }}
              className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-[#0a0f1d] border border-border/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
          >
            <option value="">All Statuses</option>
            <option value="Recognized">✓ Recognized Match</option>
            <option value="Unknown">⚠ Unknown Subject</option>
          </select>
        </div>

        {(employeeSearch || dateFilter || cameraFilter || statusFilter) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleResetFilters}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-mono underline transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Records Table */}
      <div className="glass-card rounded-2xl border border-border/80 overflow-hidden shadow-2xl">
        {error && (
          <div className="p-3.5 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface/80 border-b border-border/60 text-text-muted font-mono uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-5">Subject Profile</th>
                <th className="py-3.5 px-5">Identifier</th>
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-5">Timestamp</th>
                <th className="py-3.5 px-5">Confidence Score</th>
                <th className="py-3.5 px-5">Camera Node</th>
                <th className="py-3.5 px-5">Biometric State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    <div className="flex items-center justify-center gap-2 font-mono text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Reading audit database...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <EmptyState
                      icon={UserX}
                      title="No recognition logs recorded"
                      description="Deploy face recognition scanner to start building the forensic timeline."
                      className="border-0 bg-transparent"
                    />
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const dt = new Date(rec.timestamp);
                  const dateStr = dt.toLocaleDateString();
                  const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const isMatch = rec.status === 'Recognized';

                  return (
                    <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-3.5 px-5 font-semibold text-text">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('w-2 h-2 rounded-full', isMatch ? 'bg-emerald-400' : 'bg-rose-500')} />
                          <span>{rec.employee_name || 'Unknown Person'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-cyan-400 font-semibold">
                        {rec.employee_id || '—'}
                      </td>
                      <td className="py-3.5 px-5 text-text-muted font-mono">{dateStr}</td>
                      <td className="py-3.5 px-5 text-text-muted font-mono">{timeStr}</td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-20 bg-surface rounded-full h-1.5 overflow-hidden border border-border">
                            <div
                              className={cn('h-full', isMatch ? 'bg-emerald-400' : 'bg-rose-500')}
                              style={{ width: `${Math.min(100, rec.confidence)}%` }}
                            />
                          </div>
                          <span className={cn('font-mono font-bold', isMatch ? 'text-emerald-400' : 'text-rose-400')}>
                            {Math.round(rec.confidence)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-text-muted">{rec.camera_name}</td>
                      <td className="py-3.5 px-5">
                        <Badge
                          variant={isMatch ? 'success' : 'danger'}
                          size="xs"
                          dot
                        >
                          {rec.status?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div className="p-3.5 border-t border-border/60 flex items-center justify-between text-xs text-text-muted bg-[#050811]/60 font-mono">
          <div>
            PAGE <span className="font-bold text-white">{page}</span> OF <span className="font-bold text-white">{totalPages}</span> ({total} TOTAL RECORDS)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-xl border border-border hover:bg-surface-hover text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-white px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-xl border border-border hover:bg-surface-hover text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
