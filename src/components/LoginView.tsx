import React, { useState } from 'react';
import { 
  Server as ServerIcon, 
  ShieldCheck, 
  Lock, 
  User, 
  AlertCircle, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Activity, 
  Radio, 
  Cpu, 
  Network 
} from 'lucide-react';
import { setAuthToken } from '../utils/auth';

interface LoginViewProps {
  onLoginSuccess: (username: string, userId?: string | number, token?: string, role?: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setErrorMessage('Please enter both your username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: cleanUser, password }),
      });

      const data = await res.json();

      if (res.ok && data.authenticated) {
        const userRole = data.role || 'viewer';
        if (data.token) {
          setAuthToken(data.token, {
            username: data.username || cleanUser,
            userId: data.userId,
            role: userRole,
          });
        }
        onLoginSuccess(data.username || cleanUser, data.userId, data.token, userRole);
      } else {
        setErrorMessage(data.message || 'Invalid username or password. Access denied.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network connectivity error. Unable to reach authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-base-300 via-base-100 to-base-200 text-base-content antialiased relative overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center w-full px-4 sm:px-8 py-8 sm:py-12 z-10">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          
          {/* Left Column: PC-Style Facebook/Enterprise Brand Intro */}
          <div className="lg:col-span-7 flex flex-col justify-center text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3.5 mb-3">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-content shadow-xl shadow-primary/25 transform hover:scale-105 transition-transform shrink-0">
                <ServerIcon className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-primary leading-tight">
                  HealthStream
                </span>
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-primary/80 font-mono">
                  Infrastructure Telemetry
                </span>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-base-content tracking-tight leading-snug mt-2">
              Unified Datacenter Fleet Monitoring & SRE Telemetry Console.
            </h1>

            <p className="text-sm sm:text-base text-base-content/70 mt-3 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Real-time SNMP telemetry, live optical DOM diagnostics, IPMI environmental health, and automated threshold alerts engineered for high-availability production infrastructure.
            </p>

            {/* Feature Highlights on Desktop / Tablet */}
            <div className="hidden sm:grid grid-cols-2 gap-3.5 mt-8 max-w-xl mx-auto lg:mx-0 text-left">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-base-100/80 border border-base-content/10 shadow-xs backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-base-content">Live SNMP Monitoring</div>
                  <div className="text-[11px] text-base-content/60">Sub-second telemetry cycles</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-base-100/80 border border-base-content/10 shadow-xs backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-base-content">ICMP & DOM Optics</div>
                  <div className="text-[11px] text-base-content/60">Transceiver Tx/Rx & reachability</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-base-100/80 border border-base-content/10 shadow-xs backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-base-content">Hardware Sensors</div>
                  <div className="text-[11px] text-base-content/60">PSU, fans, thermals & ECC RAM</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-base-100/80 border border-base-content/10 shadow-xs backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-base-content">Role-Based Access</div>
                  <div className="text-[11px] text-base-content/60">Admin, Editor, & Viewer roles</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: PC-Style Facebook Login Form Card */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-end w-full">
            <div className="w-full max-w-md bg-base-100/95 backdrop-blur-xl border border-base-content/10 shadow-2xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 transition-all">
              
              <div className="mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-base-content">
                  Sign in to console
                </h2>
                <p className="text-xs text-base-content/60 mt-1">
                  Enter your credentials to access protected infrastructure controls.
                </p>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3 text-error text-xs animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-base-content/75 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>Username or Operator ID</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                    className="input input-bordered w-full text-sm bg-base-200/50 focus:bg-base-100 focus:border-primary transition-all px-3.5 h-11"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-base-content/75 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-primary" />
                      <span>Password</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      className="input input-bordered w-full text-sm bg-base-200/50 focus:bg-base-100 focus:border-primary transition-all pl-3.5 pr-10 h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/80 transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full shadow-lg shadow-primary/25 mt-2 h-11 text-sm font-bold tracking-wide flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="loading loading-spinner loading-xs" />
                      <span>Authenticating Session...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Sign In to HealthStream</span>
                      <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
                    </>
                  )}
                </button>
              </form>

              {/* Secure Session Footer Note */}
              <div className="mt-6 pt-4 border-t border-base-content/10 flex items-center justify-center gap-2 text-[11px] text-base-content/50">
                <Lock className="w-3 h-3 text-primary/70 shrink-0" />
                <span>Encrypted SRE Session &bull; Role-Based Access Control</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Subtle bottom footer */}
      <footer className="w-full py-4 px-4 text-center text-xs text-base-content/40 z-10 border-t border-base-content/5">
        <span>&copy; {new Date().getFullYear()} HealthStream Telemetry Engine &bull; Enterprise Infrastructure Management</span>
      </footer>
    </div>
  );
};

export default LoginView;
