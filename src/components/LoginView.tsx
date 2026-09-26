import React, { useState } from 'react';
import { Server as ServerIcon, ShieldCheck, Lock, User, AlertCircle, ArrowRight, KeyRound, Eye, EyeOff } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (username: string, userId?: string | number) => void;
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
        onLoginSuccess(data.username || cleanUser, data.userId);
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-base-300 via-base-100 to-base-200">
      {/* Background ambient lighting effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-base-100/90 backdrop-blur-xl border border-base-content/10 shadow-2xl rounded-2xl p-6 sm:p-8 z-10 transition-all">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-content shadow-xl shadow-primary/30 mb-3.5 transform hover:scale-105 transition-transform">
            <ServerIcon className="w-7 h-7" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black tracking-tight text-base-content">
              NOC Fleet Monitor
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase rounded-full bg-primary/15 text-primary border border-primary/20">
              v2.4
            </span>
          </div>
          <p className="text-xs text-base-content/60 max-w-xs">
            Authenticate to access mission-critical telemetry, SNMP nodes, and infrastructure controls.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3 text-error text-xs animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-base-content/70 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              <span>Username or Operator ID</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or operator"
                autoComplete="username"
                required
                className="input input-bordered w-full text-sm bg-base-200/50 focus:bg-base-100 transition-colors pl-3 pr-3"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-base-content/70 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                <span>Password</span>
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password"
                autoComplete="current-password"
                required
                className="input input-bordered w-full text-sm bg-base-200/50 focus:bg-base-100 transition-colors pl-3 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/80 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full shadow-lg shadow-primary/25 mt-2 flex items-center justify-center gap-2 font-bold tracking-wide"
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                <span>Authenticating SRE Session...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In to NOC Console</span>
                <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
              </>
            )}
          </button>
        </form>

        {/* First-time seed notice hint */}
        <div className="mt-6 pt-5 border-t border-base-content/10 flex items-start gap-2.5 text-[11px] text-base-content/50 bg-base-200/40 p-3 rounded-xl">
          <KeyRound className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-base-content/80">Fresh Install Seed Account:</span>
            <p className="mt-0.5 text-base-content/60">
              Default administrator user is seeded on first startup from <code className="px-1 py-0.5 rounded bg-base-300 font-mono text-[10px]">ADMIN_USERNAME</code> / <code className="px-1 py-0.5 rounded bg-base-300 font-mono text-[10px]">ADMIN_PASSWORD</code> (e.g. <span className="font-mono text-base-content/80">admin</span> / <span className="font-mono text-base-content/80">adminpassword123</span>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
