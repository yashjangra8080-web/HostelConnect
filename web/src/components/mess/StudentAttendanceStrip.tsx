import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Calendar,
  Check,
  Minus,
  Ban,
  Receipt,
  RefreshCw,
  QrCode,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { StatusTag } from '../ui/StatusTag.js';
import { KPIStrip } from '../ui/KPIStrip.js';
import { useToast } from '../ui/Toast.js';

interface MealSlotInfo {
  meal_id: number;
  meal_type_id: number;
  type_name: string;
  start_time: string;
  end_time: string;
  menu: string;
  is_closed: number;
  eaten: boolean;
  via: string | null;
  eaten_at: string | null;
}

interface MonthAttendanceResponse {
  student: {
    student_id: number;
    roll_number: string;
    name: string;
    hostel_id: number;
    hostel_name: string;
    room_number: string;
  };
  month: number;
  year: number;
  scheduledMeals: number;
  mealsEaten: number;
  mealsMissed: number;
  closedMeals: number;
  matrix: Record<string, Record<string, MealSlotInfo>>;
  days: {
    day: number;
    date: string;
    slots: MealSlotInfo[];
  }[];
}

interface ProjectionResponse {
  month: number;
  year: number;
  scheduledMeals: number;
  mealsEaten: number;
  freeSkips: number;
  eligibleMissed: number;
  perMealRate: number;
  foodComponent: number;
  capPct: number;
  rawRefund: number;
  cappedRefund: number;
  refundCap: number;
  flatRefundBenchmark: number;
  isCapped: boolean;
  differenceFromFlat: number;
  recordStatus: 'PREVIEW' | 'FINAL';
}

export const StudentAttendanceStrip: React.FC = () => {
  const { toast } = useToast();
  const [month, setMonth] = useState<number>(10);
  const year = 2026;
  const [loading, setLoading] = useState<boolean>(true);
  const [attendanceData, setAttendanceData] = useState<MonthAttendanceResponse | null>(null);
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);

  // Self-marking counter token input
  const [scanToken, setScanToken] = useState<string>('');
  const [isSubmittingToken, setIsSubmittingToken] = useState<boolean>(false);

  // Active tooltip slot for hover inspection
  const [hoveredSlot, setHoveredSlot] = useState<{
    date: string;
    day: number;
    slot: MealSlotInfo;
  } | null>(null);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const [attRes, projRes] = await Promise.all([
        fetch(`/api/mess/me/month?month=${month}&year=${year}`, { credentials: 'include' }),
        fetch(`/api/mess/me/projection?month=${month}&year=${year}`, { credentials: 'include' }),
      ]);

      if (!attRes.ok) throw new Error('Failed to load monthly attendance.');
      if (!projRes.ok) throw new Error('Failed to load refund projection.');

      const attJson = await attRes.json();
      const projJson = await projRes.json();

      setAttendanceData(attJson);
      setProjection(projJson);
    } catch (err: any) {
      toast.error(err.message || 'Error loading mess records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [month, year]);

  const handleMarkWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanToken.trim()) {
      toast.error('Please enter the 64-character meal QR token.');
      return;
    }

    setIsSubmittingToken(true);
    try {
      const res = await fetch('/api/mess/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: scanToken.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to record meal attendance.');
      }

      toast.success(json.message || 'Meal marked successfully via QR token!');
      setScanToken('');
      fetchAttendance();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark meal');
    } finally {
      setIsSubmittingToken(false);
    }
  };

  const mealTypes = [
    { id: 1, name: 'Breakfast', time: '07:30 - 09:30' },
    { id: 2, name: 'Lunch', time: '12:30 - 14:30' },
    { id: 3, name: 'Snacks', time: '17:00 - 18:30' },
    { id: 4, name: 'Dinner', time: '20:00 - 22:00' },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-saffron mb-1">
            <Utensils className="w-4 h-4" strokeWidth={1.75} />
            <span>HostelConnect • Resident Dining Portal</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-ink-primary">
            Mess Attendance & Refund Ledger
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            {attendanceData?.student ? (
              <>
                Resident: <strong className="font-semibold text-ink-primary">{attendanceData.student.name}</strong> ({attendanceData.student.roll_number}) • Room {attendanceData.student.room_number} ({attendanceData.student.hostel_name})
              </>
            ) : (
              'Track daily meal check-ins and verify formulated rebate calculations in IST.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface border border-border rounded px-3 py-1.5 text-xs">
            <Calendar className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent font-medium text-ink-primary focus:outline-none cursor-pointer"
            >
              <option value={9}>September 2026</option>
              <option value={10}>October 2026</option>
              <option value={11}>November 2026</option>
              <option value={12}>December 2026</option>
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={fetchAttendance} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick QR Token Check-in Bar */}
      <div className="p-4 bg-surface border border-border rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-primary-subtle text-primary border border-primary-border flex items-center justify-center shrink-0">
            <QrCode className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wider">
              Counter QR Check-in
            </h3>
            <p className="text-[11px] text-ink-muted">
              Scan the 60s rotating QR code at the dining hall or paste the rotating HMAC token here.
            </p>
          </div>
        </div>

        <form onSubmit={handleMarkWithToken} className="flex items-center gap-2 w-full md:w-auto">
          <Input
            placeholder="Paste 64-char QR Token..."
            value={scanToken}
            onChange={(e) => setScanToken(e.target.value)}
            className="w-full md:w-72 font-mono text-xs"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isSubmittingToken || !scanToken.trim()}
            className="shrink-0"
          >
            {isSubmittingToken ? 'Verifying...' : 'Record Attendance'}
          </Button>
        </form>
      </div>

      {/* KPI Overview Strip */}
      {attendanceData && (
        <section className="space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span className="font-semibold uppercase tracking-wider">Month Summary ({month}/2026)</span>
            <span className="text-ink-muted font-mono tabular-nums">IST +05:30</span>
          </div>
          <KPIStrip
            items={[
              {
                id: '1',
                label: 'Scheduled Meals',
                value: String(attendanceData.scheduledMeals),
                subtext: `${attendanceData.closedMeals} closed slot excluded`,
                badge: <StatusTag status="neutral" label="ACTIVE SLOTS" size="sm" />,
              },
              {
                id: '2',
                label: 'Meals Consumed',
                value: String(attendanceData.mealsEaten),
                subtext: `${((attendanceData.mealsEaten / (attendanceData.scheduledMeals || 1)) * 100).toFixed(1)}% attendance`,
                badge: <StatusTag status="success" label="RECORDED" size="sm" />,
              },
              {
                id: '3',
                label: 'Meals Missed',
                value: String(attendanceData.mealsMissed),
                subtext: 'Potential rebate base',
                badge: <StatusTag status="warning" label="MISSED" size="sm" />,
              },
              {
                id: '4',
                label: 'Free Skip Quota',
                value: `${projection?.freeSkips ?? 15} meals`,
                subtext: 'Built-in monthly allowance',
                badge: <StatusTag status="primary" label="ALLOWANCE" size="sm" />,
              },
            ]}
          />
        </section>
      )}

      {/* 30-Day x 4-Meal Attendance Strip Matrix */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-primary">
              30-Day × 4-Meal Attendance Strip
            </h2>
            <p className="text-xs text-ink-muted">
              Hover over any slot cell to inspect dining menu, service window, and check-in timestamp.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-ink-secondary">
              <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-400 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-emerald-800" strokeWidth={2.5} />
              </span>
              <span>Eaten</span>
            </span>
            <span className="flex items-center gap-1.5 text-ink-secondary">
              <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300 flex items-center justify-center">
                <Minus className="w-2.5 h-2.5 text-slate-500" strokeWidth={2.5} />
              </span>
              <span>Missed</span>
            </span>
            <span className="flex items-center gap-1.5 text-ink-secondary">
              <span className="w-3.5 h-3.5 rounded bg-amber-50 border border-amber-300 flex items-center justify-center">
                <Ban className="w-2.5 h-2.5 text-amber-700" strokeWidth={2.5} />
              </span>
              <span>Closed</span>
            </span>
          </div>
        </div>

        {/* Matrix Container */}
        <div className="bg-surface border border-border rounded-lg overflow-x-auto select-none shadow-none">
          <div className="min-w-[840px] p-4">
            <div className="grid grid-cols-[120px_repeat(31,minmax(22px,1fr))] gap-1 items-center">
              {/* Day Header Row */}
              <div className="text-[11px] font-semibold text-ink-muted uppercase">Day →</div>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <div
                  key={`day-head-${d}`}
                  className="text-center font-mono text-[10px] text-ink-secondary font-medium tabular-nums"
                >
                  {d}
                </div>
              ))}

              {/* 4 Meal Rows */}
              {mealTypes.map((type) => (
                <React.Fragment key={`meal-row-${type.id}`}>
                  {/* Left Label */}
                  <div className="py-2 pr-2 text-xs font-medium text-ink-primary flex flex-col justify-center border-t border-border/50">
                    <span className="truncate">{type.name}</span>
                    <span className="text-[9px] text-ink-muted font-mono truncate">{type.time}</span>
                  </div>

                  {/* 31 Day Cells */}
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                    const dayKey = String(d);
                    const slotInfo = attendanceData?.matrix?.[dayKey]?.[String(type.id)];

                    if (!slotInfo) {
                      return (
                        <div
                          key={`cell-${type.id}-${d}`}
                          className="h-8 rounded bg-surface-subtle border border-border/40 flex items-center justify-center text-[10px] text-ink-muted"
                          title={`Day ${d} - No Slot Scheduled`}
                        >
                          •
                        </div>
                      );
                    }

                    const isClosed = slotInfo.is_closed === 1;
                    const isEaten = slotInfo.eaten;

                    return (
                      <div
                        key={`cell-${type.id}-${d}`}
                        onMouseEnter={() =>
                          setHoveredSlot({
                            date: `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                            day: d,
                            slot: slotInfo,
                          })
                        }
                        className={`h-8 rounded flex items-center justify-center transition-colors cursor-pointer border ${
                          isClosed
                            ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            : isEaten
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={`Day ${d} ${type.name}: ${isClosed ? 'Closed' : isEaten ? 'Eaten' : 'Missed'}`}
                      >
                        {isClosed ? (
                          <Ban className="w-3.5 h-3.5" strokeWidth={2} />
                        ) : isEaten ? (
                          <Check className="w-3.5 h-3.5 text-emerald-700" strokeWidth={2.5} />
                        ) : (
                          <Minus className="w-3 h-3 text-slate-300" strokeWidth={2} />
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Interactive Inspection Tooltip / Drawer Footer */}
          <div className="px-5 py-3 bg-surface-subtle border-t border-border flex items-center justify-between text-xs">
            {hoveredSlot ? (
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-semibold text-ink-primary">
                  {hoveredSlot.slot.type_name} • {hoveredSlot.date} (Day {hoveredSlot.day})
                </span>
                <span className="text-ink-secondary">
                  Window: <strong className="font-mono text-ink-primary">{hoveredSlot.slot.start_time.slice(0, 5)} - {hoveredSlot.slot.end_time.slice(0, 5)}</strong>
                </span>
                <span className="text-ink-secondary">
                  Menu: <strong className="text-ink-primary">{hoveredSlot.slot.menu || 'Standard Dining Menu'}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  Status:
                  {hoveredSlot.slot.is_closed ? (
                    <StatusTag status="warning" label="CLOSED MAINTENANCE" size="sm" />
                  ) : hoveredSlot.slot.eaten ? (
                    <StatusTag
                      status="success"
                      label={`EATEN VIA ${hoveredSlot.slot.via || 'QR'}`}
                      size="sm"
                    />
                  ) : (
                    <StatusTag status="neutral" label="MISSED" size="sm" />
                  )}
                </span>
              </div>
            ) : (
              <span className="text-ink-muted italic">
                Hover over any cell above to preview meal timestamps, menu description, and serving window.
              </span>
            )}

            <span className="text-[11px] text-ink-muted font-mono shrink-0">
              {attendanceData?.days?.length || 0} days recorded
            </span>
          </div>
        </div>
      </section>

      {/* Projection Panel: Formulated Refund vs Flat Benchmark */}
      {projection && (
        <section className="space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              <Receipt className="w-4 h-4" strokeWidth={1.75} />
              <span>Financial Rebate Projection Engine</span>
            </div>
            <h2 className="text-lg font-serif font-bold text-ink-primary">
              Attendance-Based Refund vs Historical Flat Policy
            </h2>
            <p className="text-xs text-ink-secondary">
              Verified via institutional formula: <code className="bg-surface-subtle px-1 py-0.5 rounded font-mono text-[11px]">refund = LEAST(food_component * cap_pct/100, eligible_missed * per_meal_rate)</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Formulated Refund Card */}
            <div className="p-5 bg-surface border-2 border-emerald-500/40 rounded-lg space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Attendance-Based Refund
                </span>
                <StatusTag
                  status={projection.recordStatus === 'FINAL' ? 'success' : 'primary'}
                  label={projection.recordStatus}
                  size="sm"
                />
              </div>

              <div>
                <div className="text-3xl font-serif font-bold text-ink-primary font-mono tabular-nums">
                  ₹{Number(projection.cappedRefund).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-ink-secondary mt-1">
                  Based on <strong className="font-semibold text-ink-primary font-mono">{projection.eligibleMissed}</strong> eligible missed meals @ ₹{projection.perMealRate}/meal
                </div>
              </div>

              <div className="pt-3 border-t border-border/80 text-[11px] text-ink-secondary space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Raw Calculated:</span>
                  <span className="font-medium text-ink-primary">₹{Number(projection.rawRefund).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Policy Ceiling (60%):</span>
                  <span className="font-medium text-ink-primary">₹{Number(projection.refundCap).toFixed(2)}</span>
                </div>
                {projection.isCapped && (
                  <div className="text-amber-700 font-sans font-semibold">
                    * Capped at 60% of monthly food component
                  </div>
                )}
              </div>
            </div>

            {/* 2. Old Flat Refund Benchmark */}
            <div className="p-5 bg-surface border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  Historical Flat Policy
                </span>
                <StatusTag status="neutral" label="LEGACY BENCHMARK" size="sm" />
              </div>

              <div>
                <div className="text-3xl font-serif font-bold text-ink-secondary font-mono tabular-nums">
                  ₹{Number(projection.flatRefundBenchmark).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  Static uncalibrated rebate stored in <code className="font-mono text-[10px]">app_settings</code>
                </div>
              </div>

              <div className="pt-3 border-t border-border/80 text-[11px] text-ink-muted space-y-1">
                <p className="leading-relaxed">
                  The legacy flat rebate was applied uniformly regardless of whether a student consumed all meals or was away on academic leave.
                </p>
              </div>
            </div>

            {/* 3. Variance & Policy Impact */}
            <div className="p-5 bg-surface border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-primary uppercase tracking-wider">
                  Net Variance
                </span>
                {projection.differenceFromFlat >= 0 ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold font-mono">
                    <TrendingUp className="w-3.5 h-3.5" /> +₹{Math.abs(projection.differenceFromFlat).toFixed(2)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-700 font-semibold font-mono">
                    <TrendingDown className="w-3.5 h-3.5" /> -₹{Math.abs(projection.differenceFromFlat).toFixed(2)}
                  </span>
                )}
              </div>

              <div>
                <div className="text-2xl font-serif font-bold text-ink-primary font-mono tabular-nums">
                  {projection.differenceFromFlat >= 0 ? '+' : '-'}₹{Math.abs(projection.differenceFromFlat).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-ink-secondary mt-1">
                  {projection.differenceFromFlat >= 0
                    ? 'Higher refund awarded for extended absence/leaves.'
                    : 'Lower refund reflects frequent dining attendance.'}
                </div>
              </div>

              <div className="pt-3 border-t border-border/80 text-[11px] text-ink-secondary space-y-1">
                <p className="leading-relaxed">
                  Formula incentivizes dining attendance and discourages food waste while accurately crediting unconsumed meals beyond the 15-meal skip quota.
                </p>
              </div>
            </div>
          </div>

          {/* Formula Parameter Table */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-primary mb-3">
              Detailed Formula Audit Log
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 bg-surface-subtle rounded border border-border">
                <div className="text-ink-muted text-[10px]">SCHEDULED (S)</div>
                <div className="text-base font-bold text-ink-primary mt-1">{projection.scheduledMeals}</div>
                <div className="text-[10px] text-ink-muted">Non-closed meals</div>
              </div>

              <div className="p-3 bg-surface-subtle rounded border border-border">
                <div className="text-ink-muted text-[10px]">EATEN (E)</div>
                <div className="text-base font-bold text-ink-primary mt-1">{projection.mealsEaten}</div>
                <div className="text-[10px] text-ink-muted">Recorded check-ins</div>
              </div>

              <div className="p-3 bg-surface-subtle rounded border border-border">
                <div className="text-ink-muted text-[10px]">FREE SKIPS (K)</div>
                <div className="text-base font-bold text-ink-primary mt-1">{projection.freeSkips}</div>
                <div className="text-[10px] text-ink-muted">Statutory quota</div>
              </div>

              <div className="p-3 bg-surface-subtle rounded border border-border">
                <div className="text-ink-muted text-[10px]">ELIGIBLE MISSED</div>
                <div className="text-base font-bold text-emerald-700 mt-1">{projection.eligibleMissed}</div>
                <div className="text-[10px] text-ink-muted">MAX(0, S - E - K)</div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
