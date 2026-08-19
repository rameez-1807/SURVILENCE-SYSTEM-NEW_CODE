import { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  UserSquare2, 
  CalendarClock, 
  AlertCircle,
  MoreVertical,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../utils/cn';
import { FaceRegistrationModal } from '../components/FaceRegistrationModal';
import { ManualRegistrationModal } from '../components/ManualRegistrationModal';
import { FaceRecognitionModal } from '../components/FaceRecognitionModal';

export default function Attendance() {
  const [activeTab, setActiveTab] = useState<'employees' | 'records'>('records');
  
  // Data States
  const [employees, setEmployees] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiMissing, setApiMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  
  // Registration Modal State
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isManualRegistrationOpen, setIsManualRegistrationOpen] = useState(false);
  const [isRecognitionModalOpen, setIsRecognitionModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setApiMissing(false);
      
      if (activeTab === 'employees') {
        const res = await api.get('/employees');
        setEmployees(res.data.items || []);
      } else {
        const res = await api.get('/attendance');
        setRecords(res.data.items || []);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setApiMissing(true);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication required. Please log in.');
      } else {
        setError(`Failed to fetch ${activeTab} data.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    alert("Export feature requires backend generation endpoint.");
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="bg-surface border border-border rounded-lg overflow-hidden h-[600px] flex flex-col">
          <div className="h-16 border-b border-border bg-surface-hover/30"></div>
          <div className="flex-1 p-4 space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-full h-12 bg-surface-hover rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Employee & Attendance</h1>
          <p className="text-text-muted text-sm mt-1">Manage personnel and monitor AI-driven attendance records.</p>
        </div>
        
        <div className="flex gap-2 p-1 bg-surface border border-border rounded-lg">
          <button
            onClick={() => setActiveTab('records')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'records' ? "bg-primary text-white" : "text-text-muted hover:text-text hover:bg-surface-hover"
            )}
          >
            <CalendarClock className="w-4 h-4" />
            Attendance
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'employees' ? "bg-primary text-white" : "text-text-muted hover:text-text hover:bg-surface-hover"
            )}
          >
            <UserSquare2 className="w-4 h-4" />
            Employees
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col xl:flex-row gap-4 justify-between bg-surface-hover/30">
          <div className="relative w-full xl:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'records' && (
              <>
                <input 
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text"
                />
                
                <select 
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text"
                >
                  <option value="all">All Sites</option>
                  <option value="hq">Headquarters</option>
                  <option value="branch-1">Branch 1</option>
                </select>
                
                <select 
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text"
                >
                  <option value="all">All Employees</option>
                  <option value="present">Present Today</option>
                  <option value="absent">Absent</option>
                </select>
                <button 
                  onClick={() => setIsRecognitionModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors text-sm font-medium shadow-sm"
                >
                  <UserSquare2 className="w-4 h-4" />
                  Scan Face
                </button>
              </>
            )}
            
            {activeTab === 'employees' && (
              <button 
                onClick={() => setIsRegistrationModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors text-sm font-medium shadow-sm"
              >
                <UserSquare2 className="w-4 h-4" />
                Register Face
              </button>
            )}
            
            <button 
              onClick={() => setIsManualRegistrationOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-text rounded-md transition-colors text-sm font-medium shadow-sm"
            >
              Manual Entry
            </button>
            
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-surface-hover text-text rounded-md transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="w-16 h-16 text-danger/50 mb-4" />
            <h3 className="text-xl font-medium text-text mb-2">Access Error</h3>
            <p className="text-text-muted max-w-md mx-auto mb-6">{error}</p>
            <div className="flex gap-3">
              <button 
                onClick={fetchData}
                className="px-4 py-2 bg-surface border border-border hover:bg-surface-hover text-text rounded-md transition-colors"
              >
                Retry
              </button>
              <button 
                onClick={() => setIsManualRegistrationOpen(true)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors"
              >
                Manual Entry
              </button>
            </div>
          </div>
        ) : apiMissing ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <UserSquare2 className="w-16 h-16 text-text-muted/30 mb-4" />
            <h3 className="text-xl font-medium text-text mb-2">Backend Capability Required</h3>
            <p className="text-text-muted max-w-md mx-auto mb-6">
              The Face Recognition & Attendance APIs (<code className="text-primary bg-primary/10 px-1 rounded">/api/v1/{activeTab}</code>) are not yet implemented on the server.
              <br/><br/>
              Please deploy the AI Facial Recognition module to enable this feature. No fake data is shown.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'employees' ? (
              <table className="w-full text-left text-sm text-text-muted">
                <thead className="text-xs text-text uppercase bg-surface-hover border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">S.No</th>
                    <th className="px-6 py-4 font-medium">Photo</th>
                    <th className="px-6 py-4 font-medium">Emp ID</th>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Department</th>
                    <th className="px-6 py-4 font-medium">Designation</th>
                    <th className="px-6 py-4 font-medium">Enrollment</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">No employees found.</td>
                    </tr>
                  ) : (
                    // This block won't render until backend is ready, as per requirements
                    employees.map((emp, idx) => (
                      <tr key={emp.id} className="border-b border-border hover:bg-surface-hover/80 transition-colors group">
                        <td className="px-6 py-4">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <img src={emp.photo_url} alt="Profile" className="w-8 h-8 rounded-full object-cover bg-surface-hover" />
                        </td>
                        <td className="px-6 py-4">{emp.employee_id}</td>
                        <td className="px-6 py-4 font-medium text-text">{emp.name}</td>
                        <td className="px-6 py-4">{emp.department}</td>
                        <td className="px-6 py-4">{emp.designation}</td>
                        <td className="px-6 py-4">
                          {emp.is_enrolled ? (
                            <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-4 h-4"/> Enrolled</span>
                          ) : (
                            <span className="flex items-center gap-1 text-danger"><XCircle className="w-4 h-4"/> Pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-1.5 text-text-muted hover:text-primary transition-colors"><MoreVertical className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm text-text-muted">
                <thead className="text-xs text-text uppercase bg-surface-hover border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">S.No</th>
                    <th className="px-6 py-4 font-medium">Emp ID</th>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">First Seen</th>
                    <th className="px-6 py-4 font-medium">Last Seen</th>
                    <th className="px-6 py-4 font-medium">Camera</th>
                    <th className="px-6 py-4 font-medium">Confidence</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">No attendance records found.</td>
                    </tr>
                  ) : (
                    records.map((rec, idx) => (
                      <tr key={rec.id} className="border-b border-border hover:bg-surface-hover/80 transition-colors group">
                        <td className="px-6 py-4">{idx + 1}</td>
                        <td className="px-6 py-4">{rec.employee_id}</td>
                        <td className="px-6 py-4 font-medium text-text">{rec.employee_name}</td>
                        <td className="px-6 py-4">{rec.attendance_date}</td>
                        <td className="px-6 py-4 text-text">{rec.first_seen}</td>
                        <td className="px-6 py-4 text-text">{rec.last_seen}</td>
                        <td className="px-6 py-4">{rec.camera_name}</td>
                        <td className="px-6 py-4">{rec.confidence}%</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-success/20 text-success">
                            Present
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <FaceRegistrationModal 
        isOpen={isRegistrationModalOpen} 
        onClose={() => setIsRegistrationModalOpen(false)} 
        onSuccess={() => {
          fetchData();
        }}
      />

      <ManualRegistrationModal 
        isOpen={isManualRegistrationOpen}
        onClose={() => setIsManualRegistrationOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
        type={activeTab}
      />

      <FaceRecognitionModal 
        isOpen={isRecognitionModalOpen}
        onClose={() => setIsRecognitionModalOpen(false)}
      />
    </div>
  );
}
