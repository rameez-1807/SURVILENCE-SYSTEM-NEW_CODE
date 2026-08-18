import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Activity, 
  Video, 
  RefreshCw, 
  X
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../utils/cn';

export default function Cameras() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras');
      setCameras(res.data.items || []);
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication required. Please log in.');
      } else {
        setError('Failed to fetch cameras.');
      }
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (id: string) => {
    try {
      await api.post(`/cameras/${id}/test`);
      alert('Connection test requested successfully.');
    } catch (err) {
      alert('Failed to test connection.');
    }
  };

  const checkHealth = async (id: string) => {
    try {
      const res = await api.get(`/cameras/${id}/health`);
      alert(`Health Status: ${res.data.status} | Latency: ${res.data.latency_ms}ms`);
    } catch (err) {
      alert('Failed to check health.');
    }
  };

  const openLiveView = async (id: string) => {
    try {
      const res = await api.post(`/cameras/${id}/preview-token`);
      alert(`Live view URL: ${res.data.preview_url}\nToken: ${res.data.token}`);
    } catch (err) {
      alert('Failed to get live view token.');
    }
  };

  const filteredCameras = cameras.filter(cam => {
    const matchesSearch = cam.name.toLowerCase().includes(search.toLowerCase()) || 
                          cam.host.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || cam.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center h-10">
          <div className="w-32 h-8 bg-surface-hover rounded"></div>
          <div className="w-24 h-8 bg-primary/20 rounded"></div>
        </div>
        <div className="bg-surface border border-border rounded-lg overflow-hidden h-[500px] flex flex-col">
          <div className="h-16 border-b border-border bg-surface-hover/30"></div>
          <div className="flex-1 p-4 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-full h-12 bg-surface-hover rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)] animate-fade-in items-center justify-center">
        <div className="bg-surface border border-danger/50 rounded-lg p-8 max-w-md text-center">
          <Activity className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text mb-2">Access Error</h2>
          <p className="text-text-muted">{error}</p>
          <button 
            onClick={fetchCameras}
            className="mt-6 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Cameras</h1>
          <p className="text-text-muted text-sm mt-1">Manage and monitor surveillance cameras.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Camera
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between bg-surface-hover/30">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search cameras by name or host..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="offline">Offline</option>
              <option value="pending_test">Pending Test</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="text-xs text-text uppercase bg-surface-hover border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium">Camera Name</th>
                <th className="px-6 py-4 font-medium">Site</th>
                <th className="px-6 py-4 font-medium">Host / IP</th>
                <th className="px-6 py-4 font-medium">Protocol</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Last Seen</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCameras.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    No cameras found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredCameras.map((camera) => (
                  <tr key={camera.id} className="border-b border-border hover:bg-surface-hover/80 transition-colors group">
                    <td className="px-6 py-4 font-medium text-text">{camera.name}</td>
                    <td className="px-6 py-4">{camera.site_id?.substring(0, 8) || 'N/A'}</td>
                    <td className="px-6 py-4">{camera.host}</td>
                    <td className="px-6 py-4 uppercase">{camera.protocol}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-full",
                        camera.status === 'active' ? "bg-success/20 text-success" :
                        camera.status === 'offline' ? "bg-danger/20 text-danger" :
                        camera.status === 'error' ? "bg-danger/20 text-danger" :
                        "bg-warning/20 text-warning"
                      )}>
                        {camera.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">{new Date(camera.updated_at).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openLiveView(camera.id)}
                            title="Live View" 
                            className="p-1.5 text-text-muted hover:text-primary transition-colors rounded hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Video className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => checkHealth(camera.id)}
                            title="Check Health" 
                            className="p-1.5 text-text-muted hover:text-success transition-colors rounded hover:bg-surface focus:outline-none focus:ring-2 focus:ring-success opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => testConnection(camera.id)}
                            title="Test Connection" 
                            className="p-1.5 text-text-muted hover:text-warning transition-colors rounded hover:bg-surface focus:outline-none focus:ring-2 focus:ring-warning opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        <button 
                          onClick={() => setSelectedCamera(camera)}
                          title="More Actions" 
                          className="p-1.5 text-text-muted hover:text-text transition-colors rounded hover:bg-surface"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Basic Modals for Add/Edit (placeholders indicating functionality) */}
      {(isAddModalOpen || selectedCamera) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-medium text-text">
                {selectedCamera ? 'Edit Camera' : 'Add New Camera'}
              </h3>
              <button 
                onClick={() => { setIsAddModalOpen(false); setSelectedCamera(null); }}
                className="text-text-muted hover:text-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-text-muted">
                API integration for this form goes here. Ensure credentials are never exposed to the frontend as per security requirements.
              </p>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Camera Name</label>
                <input type="text" defaultValue={selectedCamera?.name || ''} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Host / IP</label>
                <input type="text" defaultValue={selectedCamera?.host || ''} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text" />
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-3">
              <button 
                onClick={() => { setIsAddModalOpen(false); setSelectedCamera(null); }}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => { setIsAddModalOpen(false); setSelectedCamera(null); }}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors text-sm font-medium"
              >
                Save Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
