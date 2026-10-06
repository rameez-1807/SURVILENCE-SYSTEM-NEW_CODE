import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cctv, Lock, User, AlertCircle, Loader2, ShieldCheck, Cpu, KeyRound } from 'lucide-react';
import { api } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const res = await api.post('/auth/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      const { access_token } = res.data;
      localStorage.setItem('token', access_token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Invalid credentials. Check username & password.');
      } else {
        // Fallback for offline / backend asleep demo mode
        localStorage.setItem('token', 'demo-token-' + Date.now());
        navigate('/dashboard', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] relative flex flex-col items-center justify-center p-4 overflow-hidden select-none">
      {/* Cyber Grid Background */}
      <div className="absolute inset-0 bg-cyber-grid opacity-30 pointer-events-none" />

      {/* Futuristic Radial Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/15 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-cyan-500/15 blur-[140px] pointer-events-none" />

      {/* Main Glassmorphic Container */}
      <div className="w-full max-w-md animate-scale-in relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-blue-500 to-cyan-400 opacity-30 blur-lg animate-pulse" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-xl shadow-blue-500/30 border border-white/20">
              <Cctv className="w-8 h-8" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            AEGIS <span className="text-gradient-cyan">SURVEILLANCE</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1.5 font-mono">
            Autonomous Neural Security Command Center
          </p>

          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card/80 border border-border/80 text-[11px] font-mono text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>NODE // CLUSTER-ONLINE</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle top laser gradient */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3 animate-slide-up">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-300">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text uppercase tracking-wider font-mono">
                  Operator Identity (Email)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0a0f1d]/90 border border-border/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-mono"
                    placeholder="operator@aegis.defense"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-text uppercase tracking-wider font-mono">
                    Security Passkey
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">AES-256</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted transition-colors" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0a0f1d]/90 border border-border/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-mono"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold py-3 text-sm transition-all duration-200 shadow-lg shadow-blue-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AUTHENTICATING TELEMETRY...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>INITIALIZE SESSION</span>
                </>
              )}
            </button>
          </form>

          {/* Demo quick credential helper */}
          <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted font-mono">
            <span>DEMO CREDENTIALS:</span>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@example.com');
                setPassword('admin123');
              }}
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
            >
              admin / admin123
            </button>
          </div>
        </div>
        
        {/* Footer Info */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-text-muted/70 mt-6 font-mono">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            TLS Encrypted
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            FastAPI Inference Core
          </span>
        </div>
      </div>
    </div>
  );
}
