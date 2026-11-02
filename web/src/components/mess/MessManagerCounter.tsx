import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Clock,
  Search,
  RefreshCw,
  Utensils,
  Copy,
  Check,
  Building,
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { StatusTag } from '../ui/StatusTag.js';
import { useToast } from '../ui/Toast.js';

interface CounterMealData {
  hostel: { hostel_id: number; hostel_name: string };
  meal: {
    meal_id: number;
    meal_type_id: number;
    type_name: string;
    start_time: string;
    end_time: string;
    meal_date: string;
    menu: string;
    is_closed: number;
  } | null;
  isActive: boolean;
  token: string | null;
  windowSeconds: number;
  windowIndex: number;
  expiresIn: number;
  markedCount: number;
  totalResidents: number;
  percentMarked: number;
  currentTimeIST: string;
  currentDateIST: string;
  todaySlots: any[];
}

export const MessManagerCounter: React.FC = () => {
  const { toast } = useToast();
  const [data, setData] = useState<CounterMealData | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [selectedHostel, setSelectedHostel] = useState<number>(1);

  // Manual fallback search state
  const [searchTerm, setSearchTerm] = useState('');
  const [residents, setResidents] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState<number | null>(null);

  // 1. Fetch live counter status
  const fetchCounter = async (hostelId = selectedHostel) => {
    try {
      const res = await fetch(`/api/mess/counter?hostel_id=${hostelId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch counter status.');
      }
      const json = await res.json();
      setData(json);

      // Generate QR Code data URL
      if (json.token) {
        const url = await QRCode.toDataURL(json.token, {
          width: 320,
          margin: 1,
          color: {
            dark: '#0C2054', // Dark Navy
            light: '#FFFFFF',
          },
        });
        setQrDataUrl(url);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error refreshing counter.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch residents for manual search
  const fetchResidents = async (hostelId = selectedHostel, search = searchTerm) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/mess/refunds?hostel_id=${hostelId}&search=${encodeURIComponent(search)}&pageSize=20`);
      if (res.ok) {
        const json = await res.json();
        setResidents(json.refunds || []);
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  // Polling: refresh counter every 5 seconds to rotate token and update live attendance
  useEffect(() => {
    fetchCounter(selectedHostel);
    const interval = setInterval(() => {
      fetchCounter(selectedHostel);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedHostel]);

  useEffect(() => {
    fetchResidents(selectedHostel, searchTerm);
  }, [selectedHostel, searchTerm]);

  // Handle manual attendance submit
  const handleMarkManual = async (studentId: number, studentName: string) => {
    if (!data?.meal) {
      toast.error('No meal slot available to mark attendance.');
      return;
    }
    setManualSubmitting(studentId);
    try {
      const res = await fetch('/api/mess/mark-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, meal_id: data.meal.meal_id }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to mark attendance.');
      }
      toast.success(`Marked present: ${studentName}`);
      fetchCounter(selectedHostel);
      fetchResidents(selectedHostel, searchTerm);
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark attendance.');
    } finally {
      setManualSubmitting(null);
    }
  };

  const copyToken = () => {
    if (data?.token) {
      navigator.clipboard.writeText(data.token);
      setCopied(true);
      toast.info('QR token copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner & Hostel Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-saffron mb-1">
            <Utensils className="w-4 h-4" strokeWidth={1.75} />
            <span>HostelConnect • Dining Operations</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-ink-primary">
            Mess Attendance Counter
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            High-contrast digital scanner console with rotating 60-second HMAC token and manual fallback roster.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <Building className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
            <span>Hostel:</span>
          </div>
          <select
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(Number(e.target.value))}
            className="text-xs bg-surface border border-border rounded px-3 py-1.5 font-medium text-ink-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={1}>BH1 — Aryabhatta Hall</option>
            <option value={2}>BH2 — Ramanujan Hall</option>
            <option value={3}>GH1 — Kalpana Chawla Hall</option>
            <option value={4}>GH2 — Gargi Hall</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => fetchCounter(selectedHostel)} isLoading={loading}>
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {/* Main Counter Display: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: QR Token & Meal Slot in Large Type (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 bg-surface border border-border rounded-xl space-y-6 shadow-sm">
            {/* Header: Meal Type in Extra Large Type */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Current Meal Window
                </span>
                <h2 className="text-3xl font-serif font-extrabold text-ink-primary tracking-tight mt-1">
                  {data?.meal?.type_name || 'MEAL SERVICE'}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-ink-secondary">
                  <Clock className="w-4 h-4 text-primary shrink-0" strokeWidth={1.75} />
                  <span className="font-mono tabular-nums font-semibold">
                    {data?.meal?.start_time?.slice(0, 5)} — {data?.meal?.end_time?.slice(0, 5)} IST
                  </span>
                  <span>•</span>
                  <span>{data?.hostel?.hostel_name}</span>
                </div>
              </div>

              <div>
                {data?.isActive ? (
                  <StatusTag status="success" label="SERVING ACTIVE" size="md" />
                ) : (
                  <StatusTag status="warning" label="OFF WINDOW" size="md" />
                )}
              </div>
            </div>

            {/* Menu Description */}
            <div className="p-3 bg-surface-subtle border border-border rounded text-xs text-ink-secondary">
              <strong className="text-ink-primary font-semibold">Menu Today: </strong>
              <span>{data?.meal?.menu || 'Standard university mess meal provisions'}</span>
            </div>

            {/* Large QR Display */}
            <div className="flex flex-col items-center justify-center p-6 bg-paper border border-border rounded-lg space-y-4">
              <div className="bg-white p-4 rounded-xl border-2 border-primary/20 shadow-none">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Mess Attendance QR Token" className="w-56 h-56 object-contain" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-xs text-ink-muted">
                    Loading QR...
                  </div>
                )}
              </div>

              {/* 60s Timer Bar */}
              <div className="w-full max-w-xs space-y-1.5 text-center">
                <div className="flex items-center justify-between text-xs text-ink-secondary font-mono">
                  <span>Rotating Token</span>
                  <span className="font-bold text-saffron tabular-nums">
                    Refreshes in {data?.expiresIn ?? 60}s
                  </span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-saffron transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(((data?.expiresIn ?? 60) / 60) * 100).toFixed(0)}%` }}
                  />
                </div>
                <p className="text-[10px] text-ink-muted mt-1">
                  SHA-256 HMAC rotated every 60 seconds. Previous window accepted for 60s grace.
                </p>
              </div>

              {/* Raw Token Copy */}
              <div className="flex items-center gap-2 max-w-md w-full pt-2">
                <input
                  type="text"
                  readOnly
                  value={data?.token || ''}
                  className="flex-1 text-[11px] font-mono bg-white border border-border rounded px-2.5 py-1 text-ink-muted truncate"
                />
                <Button variant="outline" size="sm" onClick={copyToken}>
                  {copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Marked Count & Manual Fallback (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Attendance Metric Card */}
          <div className="p-5 bg-surface border border-border rounded-xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Live Marked Attendance
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-[#059669] font-semibold bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
                Live Sync
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-serif font-black text-ink-primary tabular-nums">
                {data?.markedCount ?? 0}
              </span>
              <span className="text-sm text-ink-muted font-medium">
                / {data?.totalResidents ?? 300} resident beds
              </span>
            </div>

            {/* Attendance Percentage Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-ink-secondary">
                <span>Meal Turnout</span>
                <span className="font-bold text-primary">{data?.percentMarked ?? 0}%</span>
              </div>
              <div className="w-full h-2.5 bg-surface-subtle border border-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, data?.percentMarked ?? 0)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Manual Fallback Search Roster */}
          <div className="p-5 bg-surface border border-border rounded-xl space-y-4 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold text-ink-primary">Manual Fallback Roster</h3>
              <p className="text-xs text-ink-secondary mt-0.5">
                Search resident by roll number or name if student phone is depleted.
              </p>
            </div>

            <Input
              placeholder="Search Roll No (e.g. 2026UCS0001)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />}
            />

            {/* Resident Result List */}
            <div className="border border-border rounded-lg divide-y divide-border max-h-72 overflow-y-auto">
              {residents.length === 0 ? (
                <div className="p-4 text-center text-xs text-ink-muted">
                  {searching ? 'Searching roster...' : 'No resident students match search query.'}
                </div>
              ) : (
                residents.map((r: any) => (
                  <div
                    key={r.student_id}
                    className="p-3 flex items-center justify-between hover:bg-surface-subtle transition-colors text-xs"
                  >
                    <div>
                      <div className="font-medium text-ink-primary flex items-center gap-1.5">
                        <span>{r.full_name}</span>
                        <span className="text-[10px] font-mono text-ink-muted">({r.room_no})</span>
                      </div>
                      <div className="text-[11px] font-mono text-ink-muted tabular-nums">
                        {r.roll_no}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={manualSubmitting === r.student_id}
                      onClick={() => handleMarkManual(r.student_id, r.full_name)}
                    >
                      <Check className="w-3.5 h-3.5 text-primary" />
                      <span>Mark Present</span>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
