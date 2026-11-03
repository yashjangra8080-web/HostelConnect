import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Calendar,
  Check,
  Minus,
  Ban,
  RefreshCw,
  QrCode,
  ChevronDown,
  ChevronUp,
  Flame,
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { StatusTag } from '../ui/StatusTag.js';
import { EmptyState } from '../ui/EmptyState.js';
import { useToast } from '../ui/Toast.js';
import { formatCurrencyINR, formatDateIST } from '../../utils/format.js';

interface MealSlotInfo {
  meal_id: number;
  meal_date: string;
  menu: string;
  is_closed: number;
  closure_reason: string | null;
  meal_type_id: number;
  type_name: string;
  start_time: string;
  end_time: string;
  att_id: number | null;
  marked_via: 'QR' | 'COUNTER' | null;
  marked_at: string | null;
  status: 'EATEN' | 'MISSED' | 'CLOSED' | 'NOT_YET_SERVED';
}

interface MonthSummary {
  total_slots: number;
  scheduled: number;
  eaten: number;
  missed: number;
  closed: number;
  upcoming: number;
  streak: number;
  attendance_pct: number;
  mealTypeMeters: Record<number, { name: string; scheduled: number; eaten: number }>;
  weeklyTrend: { week: number; label: string; attendancePct: number; eaten: number; scheduled: number }[];
}

interface StudentInfo {
  student_id: number;
  roll_no: string;
  full_name: string;
  hostel_id: number;
  hostel_name: string;
  room_no: string;
}

interface MonthAttendanceResponse {
  student: StudentInfo;
  month: number;
  year: number;
  summary: MonthSummary;
  meals: MealSlotInfo[];
}

interface LedgerRecord {
  month: number;
  year: number;
  monthName: string;
  scheduled: number;
  eaten: number;
  missed: number;
  freeSkips: number;
  attendanceRefund: number;
  flatRefund: number;
  difference: number;
  status: 'FINAL' | 'PREVIEW' | 'IN_PROGRESS';
}

interface ProjectionResponse {
  student: StudentInfo;
  month: number;
  year: number;
  scheduled: number;
  eaten: number;
  free_skips: number;
  eligible_missed: number;
  per_meal_rate: number;
  food_component: number;
  cap_pct: number;
  cap_amount: number;
  attendance_refund: number;
  flat_refund: number;
  difference: number;
  is_capped: boolean;
  status: 'FINAL' | 'PREVIEW' | 'PROJECTED';
}

interface StudentAttendanceStripProps {
  onNavigate?: (path: string) => void;
}

const MONTH_NAMES: Record<number, string> = {
  9: 'September',
  10: 'October',
  11: 'November',
};

export const StudentAttendanceStrip: React.FC<StudentAttendanceStripProps> = ({ onNavigate }) => {
  const { toast } = useToast();
  // Months with data: 9 (September), 10 (October), 11 (November)
  const [month, setMonth] = useState<number>(10);
  const year = 2026;
  const [loading, setLoading] = useState<boolean>(true);
  const [isNonResident, setIsNonResident] = useState<boolean>(false);

  const [attendanceData, setAttendanceData] = useState<MonthAttendanceResponse | null>(null);
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);
  const [ledgerHistory, setLedgerHistory] = useState<LedgerRecord[]>([]);

  // Manual fallback check-in
  const [scanToken, setScanToken] = useState<string>('');
  const [isSubmittingToken, setIsSubmittingToken] = useState<boolean>(false);
  const [showManualFallback, setShowManualFallback] = useState<boolean>(false);

  // Active inspect slot
  const [activeSlot, setActiveSlot] = useState<MealSlotInfo | null>(null);

  // Tab: 'ATTENDANCE' | 'LEDGER'
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'LEDGER'>('ATTENDANCE');

  // Compute days in current month
  const daysInMonth = new Date(year, month, 0).getDate();

  // Anchor date for today check (2 Nov 2026)
  const todayDay = month === 11 ? 2 : null;

  const fetchMonthData = async () => {
    setLoading(true);
    setIsNonResident(false);

    try {
      const [attRes, projRes, ledgerRes] = await Promise.all([
        fetch(`/api/mess/me/month?month=${month}&year=${year}`, { credentials: 'include' }),
        fetch(`/api/mess/me/projection?month=${month}&year=${year}`, { credentials: 'include' }),
        fetch('/api/mess/me/ledger', { credentials: 'include' }),
      ]);

      if (attRes.status === 404) {
        setIsNonResident(true);
        setAttendanceData(null);
        return;
      }

      if (!attRes.ok) throw new Error('Failed to load mess attendance data');

      const attJson = await attRes.json();
      setAttendanceData(attJson);

      if (projRes.ok) {
        const projJson = await projRes.json();
        setProjection(projJson);
      }

      if (ledgerRes.ok) {
        const ledgerJson = await ledgerRes.json();
        if (ledgerJson.ledger) {
          setLedgerHistory(ledgerJson.ledger);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error fetching dining records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthData();
  }, [month, year]);

  const handleMarkManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanToken.trim()) {
      toast.error('Please enter the 64-character token.');
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
        throw new Error(json.message || json.error || 'Failed to record attendance');
      }

      toast.success(json.message || 'Attendance recorded successfully!');
      setScanToken('');
      setShowManualFallback(false);
      fetchMonthData();
    } catch (err: any) {
      toast.error(err.message || 'Error marking attendance');
    } finally {
      setIsSubmittingToken(false);
    }
  };

  // Build matrix lookup: `day:meal_type_id` -> MealSlotInfo
  const mealMatrix = React.useMemo(() => {
    const map = new Map<string, MealSlotInfo>();
    if (attendanceData?.meals) {
      for (const m of attendanceData.meals) {
        const dayNum = Number(m.meal_date.split('-')[2]);
        map.set(`${dayNum}:${m.meal_type_id}`, m);
      }
    }
    return map;
  }, [attendanceData]);

  const mealTypes = [
    { id: 1, name: 'Breakfast', time: '07:30 - 09:30' },
    { id: 2, name: 'Lunch', time: '12:30 - 14:30' },
    { id: 3, name: 'Snacks', time: '17:00 - 18:30' },
    { id: 4, name: 'Dinner', time: '20:00 - 22:00' },
  ];

  // =========================================================================
  // Non-Resident Empty State
  // =========================================================================
  if (!loading && isNonResident) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <EmptyState
          icon={<Utensils className="w-5 h-5 text-ink-muted" strokeWidth={1.75} />}
          title="Mess Facilities Reserved for Hostel Residents"
          description="Institutional dining facilities, daily meal attendance tracking, and mess rebate ledger calculations are available exclusively to registered hostel residents who hold an active room allotment."
          actionLabel="View Room Allotment Status"
          onAction={() => onNavigate ? onNavigate('/student/allotment') : (window.location.href = '/student/allotment')}
        />
      </div>
    );
  }

  const summary = attendanceData?.summary;
  const student = attendanceData?.student;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-14 px-4 sm:px-6">
      {/* Top Banner and Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink-primary">
            Mess Attendance & Refund Ledger
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            {student ? (
              <>
                Resident: <strong className="font-semibold text-ink-primary">{student.full_name}</strong> ({student.roll_no}) • Room {student.room_no} ({student.hostel_name})
              </>
            ) : (
              'Institutional daily dining verification and formulated rebate ledger in IST.'
            )}
          </p>
        </div>

        {/* View Tabs & Month Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="inline-flex rounded-md border border-border p-0.5 bg-surface-subtle text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('ATTENDANCE')}
              className={`px-3 py-1.5 font-medium rounded transition-colors ${
                activeTab === 'ATTENDANCE'
                  ? 'bg-surface text-ink-primary shadow-xs font-semibold'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              Attendance Strip
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('LEDGER')}
              className={`px-3 py-1.5 font-medium rounded transition-colors ${
                activeTab === 'LEDGER'
                  ? 'bg-surface text-ink-primary shadow-xs font-semibold'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              Refund Ledger
            </button>
          </div>

          {/* Month Selector (Listing only months with real data) */}
          <div className="flex items-center gap-2 bg-surface border border-border rounded px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              aria-label="Select mess attendance month"
              className="bg-transparent font-medium text-ink-primary focus:outline-none cursor-pointer"
            >
              <option value={9}>September 2026</option>
              <option value={10}>October 2026</option>
              <option value={11}>November 2026</option>
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={fetchMonthData} disabled={loading} aria-label="Refresh mess data">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {/* =====================================================================
          FLAT KPI STRIP (Eaten / Scheduled, %, Streak, Missed, Closed, Meters)
          ===================================================================== */}
      {summary && (
        <section aria-label="Monthly Attendance Performance" className="space-y-3">
          {/* Main KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* 1. Meals Eaten / Scheduled */}
            <div className="p-4 bg-surface border border-border rounded-lg space-y-1">
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                Meals Eaten / Sched.
              </span>
              <div className="text-2xl font-serif font-bold text-ink-primary tabular-nums">
                {summary.eaten} <span className="text-sm font-sans font-normal text-ink-muted">/ {summary.scheduled}</span>
              </div>
              <div className="text-[11px] text-ink-secondary font-mono">
                {summary.upcoming > 0 ? `${summary.upcoming} upcoming` : 'All slots served'}
              </div>
            </div>

            {/* 2. Attendance % */}
            <div className="p-4 bg-surface border border-border rounded-lg space-y-1">
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                Attendance Rate
              </span>
              <div className="text-2xl font-serif font-bold text-ink-primary tabular-nums">
                {summary.attendance_pct}%
              </div>
              <div className="w-full bg-surface-subtle border border-border h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${Math.min(100, summary.attendance_pct)}%` }}
                />
              </div>
            </div>

            {/* 3. Current Streak */}
            <div className="p-4 bg-surface border border-border rounded-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                  Current Streak
                </span>
                <Flame className="w-4 h-4 text-saffron shrink-0" />
              </div>
              <div className="text-2xl font-serif font-bold text-ink-primary tabular-nums">
                {summary.streak} <span className="text-xs font-sans font-normal text-ink-muted">meals</span>
              </div>
              <div className="text-[11px] text-ink-muted">Consecutive attended</div>
            </div>

            {/* 4. Missed Meals */}
            <div className="p-4 bg-surface border border-border rounded-lg space-y-1">
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                Missed Meals
              </span>
              <div className="text-2xl font-serif font-bold text-amber-700 tabular-nums">
                {summary.missed}
              </div>
              <div className="text-[11px] text-ink-muted">
                Free skip quota: {projection?.free_skips ?? 8}
              </div>
            </div>

            {/* 5. Closed Slots */}
            <div className="p-4 bg-surface border border-border rounded-lg space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                Closed Slots
              </span>
              <div className="text-2xl font-serif font-bold text-ink-secondary tabular-nums">
                {summary.closed}
              </div>
              <div className="text-[11px] text-ink-muted">Maintenance & holidays</div>
            </div>
          </div>

          {/* Sub-Strip: 4 Per-Meal-Type Meters & Weekly Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* 4 Per-Meal-Type Meters (7 cols) */}
            <div className="lg:col-span-7 p-3.5 bg-surface border border-border rounded-lg space-y-2.5">
              <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                Turnout by Meal Type
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {([1, 2, 3, 4] as const).map((mt) => {
                  const meter = summary.mealTypeMeters?.[mt] || { name: '', scheduled: 0, eaten: 0 };
                  const pct = meter.scheduled > 0 ? Math.round((meter.eaten / meter.scheduled) * 100) : 0;
                  return (
                    <div key={`meter-${mt}`} className="space-y-1 p-2 rounded bg-surface-subtle border border-border/60">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-ink-primary truncate">{meter.name}</span>
                        <span className="font-mono tabular-nums text-ink-secondary">{pct}%</span>
                      </div>
                      <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-ink-muted tabular-nums">
                        {meter.eaten} / {meter.scheduled} eaten
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly Trend (5 cols) */}
            <div className="lg:col-span-5 p-3.5 bg-surface border border-border rounded-lg space-y-2.5">
              <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                Weekly Attendance Trend
              </span>
              <div className="grid grid-cols-5 gap-1.5 text-xs">
                {summary.weeklyTrend?.map((wt) => (
                  <div key={`wt-${wt.week}`} className="flex flex-col items-center p-1.5 rounded bg-surface-subtle border border-border/60 text-center">
                    <span className="text-[10px] font-semibold text-ink-secondary">{wt.label}</span>
                    <span className="text-xs font-mono font-bold text-ink-primary mt-0.5 tabular-nums">
                      {wt.attendancePct}%
                    </span>
                    <span className="text-[9px] text-ink-muted tabular-nums mt-0.5">
                      {wt.eaten}/{wt.scheduled}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 1: DYNAMIC ATTENDANCE STRIP MATRIX
          ===================================================================== */}
      {activeTab === 'ATTENDANCE' && (
        <section aria-label="Attendance Strip Matrix" className="space-y-3">
          {/* Strip Header (Dynamic: "October 2026 — 31 days × 4 meals") */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-serif font-bold text-ink-primary">
                {MONTH_NAMES[month] || `Month ${month}`} {year} — {daysInMonth} days × 4 meals
              </h2>
              <p className="text-xs text-ink-muted">
                Each cell is keyboard-focusable with interactive tooltips. Use Tab / arrow keys to inspect.
              </p>
            </div>

            {/* Cell Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-ink-secondary">
                <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-400 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-emerald-800" strokeWidth={2.5} />
                </span>
                <span>Eaten</span>
              </span>
              <span className="flex items-center gap-1.5 text-ink-secondary">
                <span className="w-4 h-4 rounded bg-slate-100 border border-slate-300 flex items-center justify-center">
                  <Minus className="w-2.5 h-2.5 text-slate-500" strokeWidth={2.5} />
                </span>
                <span>Missed</span>
              </span>
              <span className="flex items-center gap-1.5 text-ink-secondary">
                <span
                  className="w-4 h-4 rounded border border-amber-300 flex items-center justify-center"
                  style={{
                    background: 'repeating-linear-gradient(45deg, #fef3c7, #fef3c7 2px, #fde68a 2px, #fde68a 4px)',
                  }}
                >
                  <Ban className="w-2.5 h-2.5 text-amber-800" strokeWidth={2.5} />
                </span>
                <span>Closed</span>
              </span>
              <span className="flex items-center gap-1.5 text-ink-secondary">
                <span className="w-4 h-4 rounded border border-dashed border-border flex items-center justify-center text-[9px] text-ink-muted">
                  ○
                </span>
                <span>Upcoming</span>
              </span>
            </div>
          </div>

          {/* Matrix Container: Horizontal scrolling with sticky meal labels */}
          <div className="bg-surface border border-border rounded-lg overflow-x-auto shadow-none">
            <div className="min-w-[860px] p-4">
              <div
                className="grid gap-1 items-center"
                style={{
                  gridTemplateColumns: `125px repeat(${daysInMonth}, minmax(22px, 1fr))`,
                }}
              >
                {/* Day Header Row */}
                <div className="text-[11px] font-semibold text-ink-muted uppercase sticky left-0 bg-surface z-10 pr-2">
                  Meal \ Day →
                </div>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                  const isTodayCol = todayDay === d;
                  return (
                    <div
                      key={`day-head-${d}`}
                      className={`text-center font-mono text-[10px] py-1 font-medium tabular-nums rounded ${
                        isTodayCol ? 'bg-primary/10 text-primary font-bold ring-1 ring-primary' : 'text-ink-secondary'
                      }`}
                      title={isTodayCol ? 'Today (02 Nov 2026)' : undefined}
                    >
                      {d}
                    </div>
                  );
                })}

                {/* 4 Meal Rows */}
                {mealTypes.map((type) => (
                  <React.Fragment key={`meal-row-${type.id}`}>
                    {/* Left Sticky Label */}
                    <div className="py-2.5 pr-2.5 text-xs font-semibold text-ink-primary flex flex-col justify-center border-t border-border/60 sticky left-0 bg-surface z-10">
                      <span className="truncate">{type.name}</span>
                      <span className="text-[10px] text-ink-muted font-mono font-normal truncate">
                        {type.time}
                      </span>
                    </div>

                    {/* Day Cells */}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const slot = mealMatrix.get(`${d}:${type.id}`);
                      const isTodayCol = todayDay === d;

                      if (!slot) {
                        return (
                          <div
                            key={`cell-${type.id}-${d}`}
                            className="h-8 rounded bg-surface-subtle border border-border/40 flex items-center justify-center text-[10px] text-ink-muted"
                          >
                            •
                          </div>
                        );
                      }

                      const isClosed = slot.status === 'CLOSED';
                      const isEaten = slot.status === 'EATEN';
                      const isUpcoming = slot.status === 'NOT_YET_SERVED';

                      let cellClass = '';
                      let cellStyle: React.CSSProperties = {};

                      if (isClosed) {
                        cellStyle = {
                          background: 'repeating-linear-gradient(45deg, #fef3c7, #fef3c7 3px, #fde68a 3px, #fde68a 6px)',
                        };
                        cellClass = 'border-amber-400 text-amber-800';
                      } else if (isEaten) {
                        cellClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100';
                      } else if (isUpcoming) {
                        cellClass = 'bg-surface border-dashed border-border text-ink-muted hover:border-ink-secondary';
                      } else {
                        cellClass = 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100';
                      }

                      if (isTodayCol) {
                        cellClass += ' ring-1 ring-primary';
                      }

                      return (
                        <button
                          key={`cell-${type.id}-${d}`}
                          type="button"
                          tabIndex={0}
                          onClick={() => setActiveSlot(slot)}
                          onMouseEnter={() => setActiveSlot(slot)}
                          onFocus={() => setActiveSlot(slot)}
                          className={`h-8 rounded flex items-center justify-center border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${cellClass}`}
                          style={cellStyle}
                          aria-label={`Day ${d} ${type.name}: ${
                            isClosed ? `Closed (${slot.closure_reason || 'Maintenance'})` : isEaten ? 'Eaten' : isUpcoming ? 'Upcoming' : 'Missed'
                          }`}
                        >
                          {isClosed ? (
                            <Ban className="w-3.5 h-3.5 text-amber-800" strokeWidth={2} />
                          ) : isEaten ? (
                            <Check className="w-3.5 h-3.5 text-emerald-700" strokeWidth={2.5} />
                          ) : isUpcoming ? (
                            <span className="text-[10px] text-ink-muted">○</span>
                          ) : (
                            <Minus className="w-3 h-3 text-slate-400" strokeWidth={2} />
                          )}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Interactive Inspector Footer Bar */}
            <div className="px-5 py-3.5 bg-surface-subtle border-t border-border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              {activeSlot ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-semibold text-ink-primary">
                    {activeSlot.type_name} • {formatDateIST(activeSlot.meal_date)}
                  </div>
                  <div className="text-ink-secondary">
                    Window: <span className="font-mono text-ink-primary">{activeSlot.start_time.slice(0, 5)} - {activeSlot.end_time.slice(0, 5)} IST</span>
                  </div>
                  <div className="text-ink-secondary">
                    Menu: <span className="text-ink-primary">{activeSlot.menu}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {activeSlot.status === 'CLOSED' ? (
                      <StatusTag
                        status="warning"
                        label={`CLOSED: ${activeSlot.closure_reason || 'Maintenance'}`}
                        size="sm"
                      />
                    ) : activeSlot.status === 'EATEN' ? (
                      <StatusTag
                        status="success"
                        label={`EATEN VIA ${activeSlot.marked_via || 'QR'}${activeSlot.marked_at ? ` at ${activeSlot.marked_at.slice(11, 16)} IST` : ''}`}
                        size="sm"
                      />
                    ) : activeSlot.status === 'NOT_YET_SERVED' ? (
                      <StatusTag status="neutral" label="UPCOMING / NOT YET SERVED" size="sm" />
                    ) : (
                      <StatusTag status="neutral" label="MISSED MEAL" size="sm" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-ink-muted italic">
                  Hover or focus on any meal slot above to inspect detailed menu, timing window, and check-in timestamp.
                </div>
              )}

              <div className="text-[11px] text-ink-muted font-mono shrink-0">
                IST Timezone (+05:30)
              </div>
            </div>
          </div>

          {/* Quick Counter QR Check-in Box (Replaces paste 64-char token) */}
          <div className="p-4 bg-surface border border-border rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-primary-subtle text-primary border border-primary-border flex items-center justify-center shrink-0">
                  <QrCode className="w-4.5 h-4.5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wider">
                    Counter QR Check-in
                  </h3>
                  <p className="text-[11px] text-ink-muted">
                    Scan the rotating 60-second QR code at the dining hall entrance to auto-record your meal attendance.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManualFallback((prev) => !prev)}
                >
                  <span>{showManualFallback ? 'Hide manual code' : 'Enter code manually'}</span>
                  {showManualFallback ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                </Button>
              </div>
            </div>

            {/* Collapsed manual fallback form */}
            {showManualFallback && (
              <form onSubmit={handleMarkManual} className="pt-3 border-t border-border flex flex-col sm:flex-row items-center gap-2">
                <Input
                  placeholder="Paste 64-char HMAC token from counter screen..."
                  value={scanToken}
                  onChange={(e) => setScanToken(e.target.value)}
                  className="w-full sm:flex-1 font-mono text-xs"
                />
                <Button type="submit" size="sm" disabled={isSubmittingToken || !scanToken.trim()}>
                  {isSubmittingToken ? 'Verifying...' : 'Record Attendance'}
                </Button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 2 / SECTION: REFUND LEDGER & FORMULA PROJECTION PANEL
          ===================================================================== */}
      {activeTab === 'LEDGER' && (
        <section aria-label="Mess Refund Ledger" className="space-y-6">
          {/* Multi-Month Refund Ledger Table */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-none space-y-0">
            <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-serif font-bold text-ink-primary">
                  Mess Refund Ledger by Month
                </h2>
                <p className="text-xs text-ink-secondary">
                  Audited monthly dining rebate records calculated via <code className="font-mono text-[11px] bg-surface-subtle px-1 py-0.5 rounded">sp_calculate_refunds</code>.
                </p>
              </div>
              <span className="text-xs font-mono text-ink-muted">
                Statutory Free Skips: {projection?.free_skips ?? 8} meals
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-subtle border-b border-border text-ink-secondary uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Month</th>
                    <th className="py-2.5 px-3 text-right">Scheduled</th>
                    <th className="py-2.5 px-3 text-right">Eaten</th>
                    <th className="py-2.5 px-3 text-right">Missed</th>
                    <th className="py-2.5 px-3 text-right">Free Skips</th>
                    <th className="py-2.5 px-3 text-right">Attendance Refund</th>
                    <th className="py-2.5 px-3 text-right">Flat Refund</th>
                    <th className="py-2.5 px-3 text-right">Difference</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-[11px]">
                  {ledgerHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-ink-muted font-sans text-xs">
                        No refund ledger records found.
                      </td>
                    </tr>
                  ) : (
                    ledgerHistory.map((rec) => {
                      const isPositiveDiff = rec.difference >= 0;
                      return (
                        <tr key={`ledger-${rec.month}-${rec.year}`} className="hover:bg-surface-subtle transition-colors">
                          <td className="py-3 px-4 font-sans font-medium text-ink-primary">
                            {rec.monthName}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-ink-secondary">
                            {rec.scheduled}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-ink-primary font-semibold">
                            {rec.eaten}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-amber-700">
                            {rec.missed}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-ink-muted">
                            {rec.freeSkips}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-bold text-ink-primary">
                            {formatCurrencyINR(rec.attendanceRefund)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-ink-muted">
                            {formatCurrencyINR(rec.flatRefund)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold">
                            <span className={isPositiveDiff ? 'text-emerald-700' : 'text-amber-700'}>
                              {isPositiveDiff ? '+' : ''}{formatCurrencyINR(rec.difference)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            {rec.status === 'FINAL' ? (
                              <StatusTag status="success" label="FINAL" size="sm" />
                            ) : rec.status === 'PREVIEW' ? (
                              <StatusTag status="primary" label="PREVIEW" size="sm" />
                            ) : (
                              <StatusTag status="warning" label="IN PROGRESS" size="sm" />
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Current-Month Projection Panel with Real Numbers Spelled Out */}
          {projection && (
            <div className="p-5 bg-surface border border-border rounded-lg space-y-4">
              <div>
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                  Rebate Formula Walkthrough • {MONTH_NAMES[projection.month]} {projection.year}
                </span>
                <h3 className="text-base font-serif font-bold text-ink-primary mt-0.5">
                  Institutional Attendance-Based Rebate Formula
                </h3>
                <p className="text-xs text-ink-secondary mt-1">
                  Rebate calculation verified per institutional dining statutes with real parameters:
                </p>
              </div>

              {/* Formula Mathematical Display */}
              <div className="p-4 bg-surface-subtle border border-border rounded text-xs font-mono space-y-2 text-ink-primary">
                <div>
                  <strong>Eligible Missed Meals:</strong>{' '}
                  <span className="text-emerald-700 font-bold">
                    MAX(0, Scheduled ({projection.scheduled}) - Eaten ({projection.eaten}) - Free Skips ({projection.free_skips})) = {projection.eligible_missed} meals
                  </span>
                </div>
                <div>
                  <strong>Raw Calculated Refund:</strong>{' '}
                  <span>
                    {projection.eligible_missed} meals × ₹{projection.per_meal_rate}.00/meal = ₹{(projection.eligible_missed * projection.per_meal_rate).toFixed(2)}
                  </span>
                </div>
                <div>
                  <strong>Policy Ceiling Cap (60% of Food Component):</strong>{' '}
                  <span>
                    60% of ₹{projection.food_component}.00 = ₹{projection.cap_amount}.00
                  </span>
                </div>
                <div className="pt-2 border-t border-border flex justify-between font-semibold">
                  <span>Final Calculated Rebate:</span>
                  <span className="text-emerald-700 text-sm">
                    {formatCurrencyINR(projection.attendance_refund)}
                  </span>
                </div>
              </div>

              {/* Comparison vs Flat Refund */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded bg-surface-subtle border border-border">
                  <div className="text-[10px] font-semibold text-ink-muted uppercase">Attendance Refund</div>
                  <div className="text-lg font-bold font-mono text-ink-primary mt-1">
                    {formatCurrencyINR(projection.attendance_refund)}
                  </div>
                  <div className="text-[10px] text-ink-muted">Formulated credit</div>
                </div>

                <div className="p-3 rounded bg-surface-subtle border border-border">
                  <div className="text-[10px] font-semibold text-ink-muted uppercase">Historical Flat Benchmark</div>
                  <div className="text-lg font-bold font-mono text-ink-secondary mt-1">
                    {formatCurrencyINR(projection.flat_refund)}
                  </div>
                  <div className="text-[10px] text-ink-muted">Uniform legacy rate</div>
                </div>

                <div className="p-3 rounded bg-surface-subtle border border-border">
                  <div className="text-[10px] font-semibold text-ink-muted uppercase">Net Variance</div>
                  <div className={`text-lg font-bold font-mono mt-1 ${projection.difference >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {projection.difference >= 0 ? '+' : ''}{formatCurrencyINR(projection.difference)}
                  </div>
                  <div className="text-[10px] text-ink-muted">
                    {projection.difference >= 0 ? 'Higher rebate for absence' : 'Reflects frequent dining'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
