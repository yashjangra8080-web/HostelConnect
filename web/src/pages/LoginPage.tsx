import React, { useState, useEffect } from 'react';
import { Lock, User, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';

interface PublicStats {
  applications: {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
  };
  beds: {
    total: number;
    occupied: number;
    available: number;
    totalRooms: number;
  };
  currentCycle: {
    cycle_id: number;
    academic_year: string;
    status: string;
  } | null;
  timestamp: string;
}

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<PublicStats | null>(null);

  // Fetch live facts from /api/public/stats
  useEffect(() => {
    fetch('/api/public/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) {
      setError('Please provide both Login ID and Password.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await login(loginId, password);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (userLogin: string) => {
    setLoginId(userLogin);
    setPassword('Password@123');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-between items-center py-12 px-4 selection:bg-primary-subtle">
      {/* Top Header / University Identity */}
      <div className="w-full max-w-md text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-navy-sidebar text-white font-serif font-bold text-lg mb-1 border border-border">
          HC
        </div>
        <h1 className="text-2xl font-serif font-bold tracking-tight text-ink-primary">
          HostelConnect
        </h1>
        <p className="text-xs text-ink-secondary max-w-xs mx-auto leading-relaxed">
          Netaji Subhas University of Technology, Sector 3, Dwarka, New Delhi
        </p>
      </div>

      {/* Login Card Panel */}
      <div className="w-full max-w-md bg-surface border border-border rounded-lg p-8 my-6 shadow-none">
        <div className="mb-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-ink-primary">Account Sign In</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Enter institutional credentials or student roll number
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3 rounded bg-status-danger-bg/50 border border-status-danger-border flex items-start gap-2.5 text-xs text-status-danger-text"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Login ID or Roll Number"
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="e.g. admin, office, or 2026UCS0001"
            leftIcon={<User className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />}
            disabled={isLoading}
            autoFocus
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            leftIcon={<Lock className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />}
            disabled={isLoading}
            required
          />

          <Button type="submit" variant="primary" size="md" isLoading={isLoading} className="w-full mt-2">
            Sign In to HostelConnect
          </Button>
        </form>

        {/* Quick Demo Credentials Helpers */}
        <div className="mt-6 pt-5 border-t border-border">
          <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">
            Quick Test Accounts (Password: Password@123)
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className="text-left px-2 py-1.5 rounded bg-surface-subtle border border-border hover:border-primary hover:text-primary transition-colors text-[11px]"
            >
              <strong className="font-semibold block text-ink-primary">ADMIN</strong>
              <span className="text-ink-muted">admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('warden_bh1')}
              className="text-left px-2 py-1.5 rounded bg-surface-subtle border border-border hover:border-primary hover:text-primary transition-colors text-[11px]"
            >
              <strong className="font-semibold block text-ink-primary">WARDEN</strong>
              <span className="text-ink-muted">warden_bh1</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('office')}
              className="text-left px-2 py-1.5 rounded bg-surface-subtle border border-border hover:border-primary hover:text-primary transition-colors text-[11px]"
            >
              <strong className="font-semibold block text-ink-primary">OFFICE</strong>
              <span className="text-ink-muted">office</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('2026UCSDS0001')}
              className="text-left px-2 py-1.5 rounded bg-surface-subtle border border-border hover:border-primary hover:text-primary transition-colors text-[11px]"
            >
              <strong className="font-semibold block text-ink-primary">STUDENT</strong>
              <span className="text-ink-muted">2026UCSDS0001</span>
            </button>
          </div>
        </div>
      </div>

      {/* One Quiet Line of Live Facts from /api/public/stats */}
      <div className="w-full max-w-xl text-center text-xs text-ink-muted border-t border-border pt-4">
        {stats ? (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.75} />
              <span>
                Campus Capacity:{' '}
                <strong className="font-semibold text-ink-secondary tabular-nums">
                  {stats.beds.total} beds
                </strong>{' '}
                ({stats.beds.occupied} occupied)
              </span>
            </span>
            <span className="text-border-strong">•</span>
            <span>
              Total Applicants:{' '}
              <strong className="font-semibold text-ink-secondary tabular-nums">
                {stats.applications.total}
              </strong>
            </span>
            <span className="text-border-strong">•</span>
            <span className="inline-flex items-center gap-1 text-status-success-text">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Cycle {stats.currentCycle?.academic_year || '2026-27'} Active</span>
            </span>
            <span className="text-border-strong">•</span>
            <span className="font-mono text-[11px]">IST (UTC+05:30)</span>
          </div>
        ) : (
          <p className="text-ink-muted">
            Hostel Allocation & Residence Operations System • NSUT Dwarka (IST)
          </p>
        )}
      </div>
    </div>
  );
};
