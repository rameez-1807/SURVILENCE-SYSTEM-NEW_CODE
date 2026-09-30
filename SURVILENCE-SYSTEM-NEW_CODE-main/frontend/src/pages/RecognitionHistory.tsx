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

  // Stats calculation
  const recognizedCount = records.filter(r => r.status === 'Recognized').length;
  const avgConfidence = records.length > 0
    ? Math.round(records.reduce((acc, curr) => acc + curr.confidence, 0) / records.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">Face Recognition History</h1>
            <p className="text-xs text-text-muted">Real-time audit log of biometric recognition events</p>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-border text-text border border-border rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Audit Logs
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-border space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Total Recognition Logs</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-text">{total}</div>
          <div className="text-[11px] text-text-muted">Filtered total events in database</div>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Recognized Matches</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{recognizedCount}</div>
          <div className="text-[11px] text-text-muted">Verified employee profiles on page</div>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Average Match Confidence</span>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary">{avgConfidence}%</div>
          <div className="text-[11px] text-text-muted">Mean Euclidean distance confidence</div>
        </div>

        <div className="bg-surface p-5 rounded-xl border border-border space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Active Camera Feeds</span>
            <Cctv className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-text">Live Camera</div>
          <div className="text-[11px] text-text-muted">Primary surveillance source</div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
          <Filter className="w-3.5 h-3.5 text-primary" />
          Filter Audit Logs
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Employee Name/ID */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search Name or Employee ID..."
              value={employeeSearch}
              onChange={(e) => { setEmployeeSearch(e.target.value); setPage(1); }}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filter Date */}
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filter Camera */}
          <div className="relative">
            <Cctv className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Filter Camera Source..."
              value={cameraFilter}
              onChange={(e) => { setCameraFilter(e.target.value); setPage(1); }}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="Recognized">✓ Recognized</option>
            <option value="Unknown">⚠ Unknown</option>
          </select>
        </div>

        {(employeeSearch || dateFilter || cameraFilter || statusFilter) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleResetFilters}
              className="text-xs text-primary hover:underline font-medium"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Records Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
        {error && (
          <div className="p-4 bg-danger/10 border-b border-danger/20 text-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-hover/50 border-b border-border text-text-muted font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Employee Name</th>
                <th className="py-3.5 px-4">Employee ID</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Time</th>
                <th className="py-3.5 px-4">Confidence</th>
                <th className="py-3.5 px-4">Camera Source</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      Loading recognition audit logs...
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-2 max-w-sm mx-auto">
                      <UserX className="w-8 h-8 opacity-40" />
                      <p className="font-semibold text-text">No Recognition Events Found</p>
                      <p className="text-[11px]">Perform live face recognition using the camera to populate audit logs.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const dt = new Date(rec.timestamp);
                  const dateStr = dt.toLocaleDateString();
                  const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const isMatch = rec.status === 'Recognized';

                  return (
                    <tr key={rec.id} className="hover:bg-surface-hover/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-text">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isMatch ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                          {rec.employee_name || 'Unknown Person'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-primary">
                        {rec.employee_id || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-text-muted">{dateStr}</td>
                      <td className="py-3.5 px-4 text-text-muted font-mono">{timeStr}</td>
                      <td className="py-3.5 px-4 font-semibold">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-surface-hover rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${isMatch ? 'bg-emerald-400' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, rec.confidence)}%` }}
                            />
                          </div>
                          <span className={isMatch ? 'text-emerald-400' : 'text-rose-400'}>
                            {Math.round(rec.confidence)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-text-muted">{rec.camera_name}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isMatch 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isMatch ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs text-text-muted bg-surface-hover/20">
          <div>
            Showing Page <span className="font-bold text-text">{page}</span> of <span className="font-bold text-text">{totalPages}</span> ({total} records total)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-border hover:bg-surface-hover text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-text text-xs px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-border hover:bg-surface-hover text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
