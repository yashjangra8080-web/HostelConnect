import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Clock,
  Search,
  RefreshCw,
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
  fourteenDayTrend?: { date: string; attended: number; scheduled: number }[];
  mealTypeRates?: { meal_type_id: number; type_name: string; attended: number; scheduled: number }[];
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

      // Generate QR Code data URL encoding /mess/check-in?t=...
      if (json.token) {
        const checkInUrl = `${window.location.origin}/mess/check-in?t=${encodeURIComponent(json.token)}`;
        const url = await QRCode.toDataURL(checkInUrl, {
          width: 320,
          margin: 1,
          color: {
            dark: '#000000', // Pure Black for Neo-Brutalist max scan contrast
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
      <div className="bg-surface border-2 border-black rounded-sm p-6 shadow-hard-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold font-heading text-ink-primary tracking-tight">
              Mess Attendance Counter
            </h1>
            <p className="text-xs font-medium text-ink-secondary mt-1">
              High-contrast digital scanner console with rotating 60-second HMAC token and manual fallback roster.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink-secondary">
              <Building className="w-4 h-4 text-ink-primary" strokeWidth={2} />
              <span>Hostel:</span>
            </div>
            <select
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(Number(e.target.value))}
              className="text-xs bg-surface border-2 border-black rounded-sm px-3 py-1.5 font-bold text-ink-primary shadow-hard-sm focus:outline-none cursor-pointer"
            >
              <option value={1}>BH1 — Aryabhatta Hall</option>
              <option value={2}>BH2 — Ramanujan Hall</option>
              <option value={3}>GH1 — Kalpana Chawla Hall</option>
              <option value={4}>GH2 — Gargi Hall</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => fetchCounter(selectedHostel)} isLoading={loading}>
              <RefreshCw className="w-4 h-4" strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Counter Display: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: QR Token & Meal Slot in Large Type (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 bg-surface border-2 border-black rounded-sm space-y-6 shadow-hard-lg">
            {/* Header: Meal Type in Extra Large Type */}
            <div className="flex items-start justify-between border-b-2 border-black pb-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
                  Current Meal Window
                </span>
                <h2 className="text-3xl font-heading font-extrabold text-ink-primary tracking-tight mt-1">
                  {data?.meal?.type_name || 'MEAL SERVICE'}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 text-xs font-bold text-ink-secondary">
                  <Clock className="w-4 h-4 text-ink-primary shrink-0" strokeWidth={2} />
                  <span className="font-mono tabular-nums">
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
            <div className="p-3.5 bg-paper border-2 border-black rounded-sm shadow-hard-sm text-xs font-medium text-ink-primary">
              <strong className="text-ink-primary font-extrabold">Menu Today: </strong>
              <span>{data?.meal?.menu || 'Standard university mess meal provisions'}</span>
            </div>

            {/* Large QR Display */}
            <div className="flex flex-col items-center justify-center p-6 bg-dots bg-paper border-2 border-black rounded-sm space-y-4 shadow-hard">
              <div className="bg-white p-4 rounded-sm border-2 border-black shadow-hard-lg">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Mess Attendance QR Token" className="w-56 h-56 object-contain" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-xs font-bold text-ink-muted">
                    Loading QR...
                  </div>
                )}
              </div>

              {/* 60s Timer Bar */}
              <div className="w-full max-w-xs space-y-2 text-center">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-ink-primary">
                  <span>Rotating Token</span>
                  <span className="tabular-nums">
                    Refreshes in {data?.expiresIn ?? 60}s
                  </span>
                </div>
                <div className="w-full h-3 bg-surface border-2 border-black rounded-sm overflow-hidden shadow-hard-sm">
                  <div
                    className="h-full bg-saffron transition-all duration-1000 ease-linear border-r-2 border-black"
                    style={{ width: `${(((data?.expiresIn ?? 60) / 60) * 100).toFixed(0)}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold text-ink-secondary mt-1">
                  SHA-256 HMAC rotated every 60 seconds. Previous window accepted for 60s grace.
                </p>
              </div>

              {/* Raw Token Copy */}
              <div className="flex items-center gap-2 max-w-md w-full pt-2">
                <input
                  type="text"
                  readOnly
                  value={data?.token || ''}
                  className="flex-1 text-[11px] font-mono font-bold bg-white border-2 border-black rounded-sm px-3 py-1.5 text-ink-primary truncate shadow-hard-sm"
                />
                <Button variant="outline" size="sm" onClick={copyToken}>
                  {copied ? <Check className="w-3.5 h-3.5 text-status-success-text" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Marked Count & Manual Fallback (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Attendance Metric Card */}
          <div className="p-5 bg-surface border-2 border-black rounded-sm space-y-4 shadow-hard-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary">
                Live Marked Attendance
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-status-success-text font-extrabold bg-status-success-subtle px-2.5 py-0.5 rounded-sm border-2 border-black shadow-hard-sm">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                Live Sync
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-heading font-black text-ink-primary tabular-nums">
                {data?.markedCount ?? 0}
              </span>
              <span className="text-sm text-ink-secondary font-bold">
                / {data?.totalResidents ?? 300} resident beds
              </span>
            </div>

            {/* Attendance Percentage Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-ink-secondary">
                <span>Meal Turnout</span>
                <span className="text-ink-primary">{data?.percentMarked ?? 0}%</span>
              </div>
              <div className="w-full h-3.5 bg-surface-subtle border-2 border-black rounded-sm overflow-hidden shadow-hard-sm">
                <div
                  className="h-full bg-black transition-all duration-500"
                  style={{ width: `${Math.min(100, data?.percentMarked ?? 0)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Manual Fallback Search Roster */}
          <div className="p-5 bg-surface border-2 border-black rounded-sm space-y-4 shadow-hard-lg">
            <div>
              <h3 className="text-sm font-extrabold font-heading text-ink-primary">Manual Fallback Roster</h3>
              <p className="text-xs font-medium text-ink-secondary mt-0.5">
                Search resident by roll number or name if student phone is depleted.
              </p>
            </div>

            <Input
              placeholder="Search Roll No (e.g. 2026UCS0001)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-ink-primary" strokeWidth={2} />}
            />

            {/* Resident Result List */}
            <div className="border-2 border-black rounded-sm divide-y-2 divide-black max-h-72 overflow-y-auto shadow-hard-sm">
              {residents.length === 0 ? (
                <div className="p-4 text-center text-xs font-bold text-ink-muted">
                  {searching ? 'Searching roster...' : 'No resident students match search query.'}
                </div>
              ) : (
                residents.map((r: any) => (
                  <div
                    key={r.student_id}
                    className="p-3 flex items-center justify-between hover:bg-paper/30 transition-colors text-xs"
                  >
                    <div>
                      <div className="font-extrabold text-ink-primary flex items-center gap-1.5">
                        <span>{r.full_name}</span>
                        <span className="text-[10px] font-mono text-ink-secondary">({r.room_no})</span>
                      </div>
                      <div className="text-[11px] font-mono font-bold text-ink-secondary tabular-nums">
                        {r.roll_no}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={manualSubmitting === r.student_id}
                      onClick={() => handleMarkManual(r.student_id, r.full_name)}
                    >
                      <Check className="w-3.5 h-3.5 text-ink-primary" strokeWidth={2} />
                      <span>Mark Present</span>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Headcount Across All 4 Meals */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs font-extrabold text-ink-secondary">
          <span className="uppercase tracking-wider text-ink-primary">
            Today's Headcount per Meal Slot (Hostel {selectedHostel})
          </span>
          <span className="font-mono text-ink-primary">Resident Count: {data?.totalResidents ?? 75}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(data?.todaySlots || []).map((slot: any) => {
            const count = Number(slot.marked_count || 0);
            const total = Number(data?.totalResidents || 75);
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const isClosed = slot.is_closed === 1;

            return (
              <div key={`today-slot-${slot.meal_id}`} className="p-4 bg-surface border-2 border-black rounded-sm shadow-hard space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-ink-primary">{slot.type_name}</span>
                  {isClosed ? (
                    <StatusTag status="warning" label="CLOSED" size="sm" />
                  ) : (
                    <span className="text-[10px] font-mono font-bold text-ink-secondary">
                      {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-heading font-black text-ink-primary tabular-nums">
                    {count} <span className="text-xs font-sans text-ink-secondary font-bold">/ {total}</span>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-ink-primary tabular-nums">{pct}%</span>
                </div>

                <div className="w-full bg-surface-subtle border-2 border-black h-2 rounded-sm overflow-hidden shadow-hard-sm">
                  <div className="bg-saffron h-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 14-Day Trend & 30-Day Per-Meal Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 14-Day Daily Attendance Trend (7 cols) */}
        <div className="lg:col-span-7 p-5 bg-surface border-2 border-black rounded-sm space-y-3 shadow-hard">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-ink-primary">
              14-Day Daily Turnout Trend
            </span>
            <span className="text-[11px] font-mono font-bold text-ink-secondary">Daily Attendance %</span>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 text-center items-end min-h-[90px] pt-4">
            {(data?.fourteenDayTrend || []).map((t: any) => {
              const attended = Number(t.attended || 0);
              const scheduled = Number(t.scheduled || 1);
              const pct = scheduled > 0 ? Math.min(100, Math.round((attended / scheduled) * 100)) : 0;
              const dayStr = t.date ? t.date.slice(8, 10) : '';

              return (
                <div key={`trend-${t.date}`} className="flex flex-col items-center gap-1 group">
                  <div className="text-[9px] font-mono font-bold text-ink-secondary group-hover:text-ink-primary tabular-nums">
                    {pct}%
                  </div>
                  <div className="w-full h-14 bg-surface-subtle border-2 border-black rounded-t-sm flex items-end overflow-hidden shadow-hard-sm">
                    <div
                      className="w-full bg-black transition-all duration-300"
                      style={{ height: `${pct}%` }}
                      title={`${t.date}: ${attended}/${scheduled} meals (${pct}%)`}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-ink-primary">{dayStr}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 30-Day Per-Meal-Type Turnover Rates (5 cols) */}
        <div className="lg:col-span-5 p-5 bg-surface border-2 border-black rounded-sm space-y-3 shadow-hard">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-ink-primary">
              Per-Meal-Type Rates (Past 30 Days)
            </span>
            <span className="text-[11px] font-mono font-bold text-ink-secondary">Turnout %</span>
          </div>

          <div className="space-y-3 pt-1">
            {(data?.mealTypeRates || []).map((rate: any) => {
              const attended = Number(rate.attended || 0);
              const scheduled = Number(rate.scheduled || 1);
              const pct = scheduled > 0 ? Math.round((attended / scheduled) * 100) : 0;

              return (
                <div key={`rate-${rate.meal_type_id}`} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-extrabold text-ink-primary">{rate.type_name}</span>
                    <span className="font-mono font-bold text-ink-secondary tabular-nums">
                      {attended} / {scheduled} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-subtle border-2 border-black h-2.5 rounded-sm overflow-hidden shadow-hard-sm">
                    <div className="bg-saffron h-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
