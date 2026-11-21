import React, { useState, useEffect } from 'react';
import { Lock, User, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiUrl } from '../utils/api.js';
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
    fetch(apiUrl('/api/public/stats'))
      .then(async (res) => {
        if (!res.ok) return null;
        try {
          return await res.json();
        } catch {
          return null;
        }
      })
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
    <div className="min-h-screen flex flex-col justify-between selection:bg-saffron">
      {/* Band 1: Yellow Hero Band with Dot Pattern & Login Card */}
      <section className="bg-dots border-b-2 border-black flex flex-col items-center justify-center py-12 px-4 flex-1">
        <div className="w-full max-w-md text-center space-y-2 mb-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[4px] bg-saffron text-black font-heading font-extrabold text-xl mb-1 border-2 border-black shadow-hard-sm">
            HC
          </div>
          <h1 className="text-3xl font-heading font-extrabold tracking-tight text-black">
            HostelConnect
          </h1>
          <p className="text-xs text-black font-bold max-w-xs mx-auto leading-relaxed">
            Netaji Subhas University of Technology, Sector 3, Dwarka, New Delhi
          </p>
        </div>

        {/* Login Card Panel */}
        <div className="w-full max-w-md bg-white border-2 border-black rounded-[4px] p-8 my-4 shadow-hard-lg">
          <div className="mb-6 pb-4 border-b-2 border-black">
            <h2 className="text-lg font-heading font-extrabold text-black">Account Sign In</h2>
            <p className="text-xs text-black/70 font-medium mt-0.5">
              Enter institutional credentials or student roll number
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-[4px] bg-status-danger-bg border-2 border-black flex items-start gap-2.5 text-xs text-status-danger-text font-bold"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.5} />
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
              leftIcon={<User className="w-4 h-4 text-black" strokeWidth={2} />}
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
              leftIcon={<Lock className="w-4 h-4 text-black" strokeWidth={2} />}
              disabled={isLoading}
              required
            />

            <Button type="submit" variant="primary" size="md" isLoading={isLoading} className="w-full mt-2">
              Sign In to HostelConnect
            </Button>
          </form>

          {/* Quick Demo Credentials Helpers */}
          <div className="mt-6 pt-5 border-t-2 border-black">
            <p className="text-[11px] font-heading font-extrabold text-black uppercase tracking-wider mb-2">
              Quick Test Accounts (Password: Password@123)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="text-left px-2.5 py-2 rounded-[8px] bg-white border-2 border-black text-black hover:bg-saffron shadow-hard-sm transition-colors text-[11px]"
              >
                <strong className="font-heading font-extrabold block text-black">ADMIN</strong>
                <span className="text-black/70 font-mono font-medium">admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('warden_bh1')}
                className="text-left px-2.5 py-2 rounded-[8px] bg-white border-2 border-black text-black hover:bg-saffron shadow-hard-sm transition-colors text-[11px]"
              >
                <strong className="font-heading font-extrabold block text-black">WARDEN</strong>
                <span className="text-black/70 font-mono font-medium">warden_bh1</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('office')}
                className="text-left px-2.5 py-2 rounded-[8px] bg-white border-2 border-black text-black hover:bg-saffron shadow-hard-sm transition-colors text-[11px]"
              >
                <strong className="font-heading font-extrabold block text-black">OFFICE</strong>
                <span className="text-black/70 font-mono font-medium">office</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('2026UCSDS0001')}
                className="text-left px-2.5 py-2 rounded-[8px] bg-white border-2 border-black text-black hover:bg-saffron shadow-hard-sm transition-colors text-[11px]"
              >
                <strong className="font-heading font-extrabold block text-black">STUDENT</strong>
                <span className="text-black/70 font-mono font-medium">2026UCSDS0001</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Band 2: White Band with Live Statistics Strip */}
      <section className="bg-white border-b-2 border-black py-5 px-4 text-center text-xs text-black font-bold">
        <div className="max-w-4xl mx-auto">
          {stats ? (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border-2 border-black rounded-[4px] shadow-hard-sm">
                <Building2 className="w-4 h-4 text-black shrink-0" strokeWidth={2} />
                <span>
                  Campus Capacity:{' '}
                  <strong className="font-extrabold text-black tabular-nums">
                    {stats.beds.total} beds
                  </strong>{' '}
                  ({stats.beds.occupied} occupied)
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border-2 border-black rounded-[4px] shadow-hard-sm">
                <span>
                  Total Applicants:{' '}
                  <strong className="font-extrabold text-black tabular-nums">
                    {stats.applications.total}
                  </strong>
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-paper border-2 border-black rounded-[4px] shadow-hard-sm text-black">
                <CheckCircle2 className="w-4 h-4 text-status-success-text" strokeWidth={2.5} />
                <span>Cycle {stats.currentCycle?.academic_year || '2026-27'} Active</span>
              </span>
              <span className="px-3 py-1 bg-white border-2 border-black rounded-[4px] shadow-hard-sm font-mono text-[11px]">
                IST (UTC+05:30)
              </span>
            </div>
          ) : (
            <p className="text-black font-bold">
              Hostel Allocation & Residence Operations System • Netaji Subhas University of Technology (IST)
            </p>
          )}
        </div>
      </section>

      {/* Band 3: Dark Band Footer */}
      <footer className="bg-navy-sidebar text-white py-6 px-4 text-center text-xs font-medium">
        <div className="max-w-4xl mx-auto space-y-1">
          <p className="font-heading font-bold text-sm text-white">
            HostelConnect • Netaji Subhas University of Technology, Dwarka
          </p>
          <p className="text-surface-subtle text-[11px]">
            Strictly operating in Indian Standard Time (IST, UTC+05:30) • WCAG 2.1 AA Compliant Institutional Architecture
          </p>
        </div>
      </footer>
    </div>
  );
};
