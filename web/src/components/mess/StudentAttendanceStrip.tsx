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
          icon={<Utensils className="w-6 h-6 text-ink-muted" strokeWidth={2} />}
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
      <div className="bg-surface border-2 border-black rounded-sm p-6 shadow-hard-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold font-heading text-ink-primary tracking-tight">
              Mess Attendance & Refund Ledger
            </h1>
            <p className="text-xs font-medium text-ink-secondary mt-1">
              {student ? (
                <>
                  Resident: <strong className="font-extrabold text-ink-primary">{student.full_name}</strong> ({student.roll_no}) • Room {student.room_no} ({student.hostel_name})
                </>
              ) : (
                'Institutional daily dining verification and formulated rebate ledger in IST.'
              )}
            </p>
          </div>

          {/* View Tabs & Month Selector */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Toggle */}
            <div className="inline-flex rounded-sm border-2 border-black p-0.5 bg-surface-subtle text-xs shadow-hard-sm">
              <button
                type="button"
                onClick={() => setActiveTab('ATTENDANCE')}
                className={`px-3.5 py-1.5 font-extrabold rounded-sm transition-all ${
                  activeTab === 'ATTENDANCE'
                    ? 'bg-saffron text-black border-2 border-black shadow-hard-sm'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                Attendance Strip
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('LEDGER')}
                className={`px-3.5 py-1.5 font-extrabold rounded-sm transition-all ${
                  activeTab === 'LEDGER'
                    ? 'bg-saffron text-black border-2 border-black shadow-hard-sm'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                Refund Ledger
              </button>
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-2 bg-surface border-2 border-black rounded-sm px-3 py-1.5 text-xs shadow-hard-sm">
              <Calendar className="w-4 h-4 text-ink-primary" strokeWidth={2} />
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                aria-label="Select mess attendance month"
                className="bg-transparent font-extrabold text-ink-primary focus:outline-none cursor-pointer"
              >
                <option value={9}>September 2026</option>
                <option value={10}>October 2026</option>
                <option value={11}>November 2026</option>
              </select>
            </div>

            <Button variant="outline" size="sm" onClick={fetchMonthData} disabled={loading} aria-label="Refresh mess data">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          FLAT KPI STRIP (Eaten / Scheduled, %, Streak, Missed, Closed, Meters)
          ===================================================================== */}
      {summary && (
        <section aria-label="Monthly Attendance Performance" className="space-y-4">
          {/* Main KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* 1. Meals Eaten / Scheduled */}
            <div className="p-4 bg-surface border-2 border-black rounded-sm space-y-1 shadow-hard">
              <span className="text-[11px] font-extrabold text-ink-secondary uppercase tracking-wider">
                Meals Eaten / Sched.
              </span>
              <div className="text-2xl font-heading font-black text-ink-primary tabular-nums">
                {summary.eaten} <span className="text-sm font-sans font-bold text-ink-secondary">/ {summary.scheduled}</span>
              </div>
              <div className="text-[11px] text-ink-secondary font-mono font-bold">
                {summary.upcoming > 0 ? `${summary.upcoming} upcoming` : 'All slots served'}
              </div>
            </div>

            {/* 2. Attendance % */}
            <div className="p-4 bg-surface border-2 border-black rounded-sm space-y-1 shadow-hard">
              <span className="text-[11px] font-extrabold text-ink-secondary uppercase tracking-wider">
                Attendance Rate
              </span>
              <div className="text-2xl font-heading font-black text-ink-primary tabular-nums">
                {summary.attendance_pct}%
              </div>
              <div className="w-full bg-surface-subtle border-2 border-black h-2 rounded-sm overflow-hidden mt-1 shadow-hard-sm">
                <div
                  className="bg-saffron h-full transition-all"
                  style={{ width: `${Math.min(100, summary.attendance_pct)}%` }}
                />
              </div>
            </div>

            {/* 3. Current Streak */}
            <div className="p-4 bg-surface border-2 border-black rounded-sm space-y-1 shadow-hard">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-ink-secondary uppercase tracking-wider">
                  Current Streak
                </span>
                <Flame className="w-4 h-4 text-black shrink-0" strokeWidth={2.5} />
              </div>
              <div className="text-2xl font-heading font-black text-ink-primary tabular-nums">
                {summary.streak} <span className="text-xs font-sans font-bold text-ink-secondary">meals</span>
              </div>
              <div className="text-[11px] font-bold text-ink-secondary">Consecutive attended</div>
            </div>

            {/* 4. Missed Meals */}
            <div className="p-4 bg-surface border-2 border-black rounded-sm space-y-1 shadow-hard">
              <span className="text-[11px] font-extrabold text-ink-secondary uppercase tracking-wider">
                Missed Meals
              </span>
              <div className="text-2xl font-heading font-black text-status-warning-text tabular-nums">
                {summary.missed}
              </div>
              <div className="text-[11px] font-bold text-ink-secondary">
                Free skip quota: {projection?.free_skips ?? 8}
              </div>
            </div>

            {/* 5. Closed Slots */}
            <div className="p-4 bg-surface border-2 border-black rounded-sm space-y-1 col-span-2 sm:col-span-1 shadow-hard">
              <span className="text-[11px] font-extrabold text-ink-secondary uppercase tracking-wider">
                Closed Slots
              </span>
              <div className="text-2xl font-heading font-black text-ink-primary tabular-nums">
                {summary.closed}
              </div>
              <div className="text-[11px] font-bold text-ink-secondary">Maintenance & holidays</div>
            </div>
          </div>

          {/* Sub-Strip: 4 Per-Meal-Type Meters & Weekly Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 4 Per-Meal-Type Meters (7 cols) */}
            <div className="lg:col-span-7 p-4 bg-surface border-2 border-black rounded-sm space-y-3 shadow-hard">
              <span className="text-[10px] font-extrabold text-ink-secondary uppercase tracking-wider">
                Turnout by Meal Type
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {([1, 2, 3, 4] as const).map((mt) => {
                  const meter = summary.mealTypeMeters?.[mt] || { name: '', scheduled: 0, eaten: 0 };
                  const pct = meter.scheduled > 0 ? Math.round((meter.eaten / meter.scheduled) * 100) : 0;
                  return (
                    <div key={`meter-${mt}`} className="space-y-1.5 p-2.5 rounded-sm bg-surface border-2 border-black shadow-hard-sm">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold text-ink-primary truncate">{meter.name}</span>
                        <span className="font-mono font-bold tabular-nums text-ink-primary">{pct}%</span>
                      </div>
                      <div className="w-full bg-surface-subtle border border-black h-2 rounded-sm overflow-hidden">
                        <div
                          className="bg-black h-full transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-bold text-ink-secondary tabular-nums">
                        {meter.eaten} / {meter.scheduled} eaten
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly Trend (5 cols) */}
            <div className="lg:col-span-5 p-4 bg-surface border-2 border-black rounded-sm space-y-3 shadow-hard">
              <span className="text-[10px] font-extrabold text-ink-secondary uppercase tracking-wider">
                Weekly Attendance Trend
              </span>
              <div className="grid grid-cols-5 gap-2 text-xs">
                {summary.weeklyTrend?.map((wt) => (
                  <div key={`wt-${wt.week}`} className="flex flex-col items-center p-2 rounded-sm bg-surface border-2 border-black shadow-hard-sm text-center">
                    <span className="text-[10px] font-extrabold text-ink-secondary">{wt.label}</span>
                    <span className="text-xs font-mono font-black text-ink-primary mt-1 tabular-nums">
                      {wt.attendancePct}%
                    </span>
                    <span className="text-[9px] font-bold text-ink-secondary tabular-nums mt-0.5">
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
        <section aria-label="Attendance Strip Matrix" className="space-y-4">
          {/* Strip Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-heading font-extrabold text-ink-primary">
                {MONTH_NAMES[month] || `Month ${month}`} {year} — {daysInMonth} days × 4 meals
              </h2>
              <p className="text-xs font-medium text-ink-secondary">
                Each cell is keyboard-focusable with interactive tooltips. Use Tab / arrow keys to inspect.
              </p>
            </div>

            {/* Cell Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-ink-primary font-bold">
                <span className="w-4 h-4 rounded-sm bg-status-success-subtle border-2 border-black flex items-center justify-center shadow-hard-sm">
                  <Check className="w-2.5 h-2.5 text-status-success-text" strokeWidth={3} />
                </span>
                <span>Eaten</span>
              </span>
              <span className="flex items-center gap-1.5 text-ink-primary font-bold">
                <span className="w-4 h-4 rounded-sm bg-surface border-2 border-black flex items-center justify-center shadow-hard-sm">
                  <Minus className="w-2.5 h-2.5 text-ink-muted" strokeWidth={3} />
                </span>
                <span>Missed</span>
              </span>
              <span className="flex items-center gap-1.5 text-ink-primary font-bold">
                <span
                  className="w-4 h-4 rounded-sm border-2 border-black flex items-center justify-center shadow-hard-sm"
                  style={{
                    background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 2px, transparent 2px, transparent 4px)',
                  }}
                >
                  <Ban className="w-2.5 h-2.5 text-ink-primary" strokeWidth={3} />
                </span>
                <span>Closed</span>
              </span>
              <span className="flex items-center gap-1.5 text-ink-primary font-bold">
                <span className="w-4 h-4 rounded-sm border-2 border-dashed border-black flex items-center justify-center text-[9px] font-bold text-ink-muted">
                  ○
                </span>
                <span>Upcoming</span>
              </span>
            </div>
          </div>

          {/* Matrix Container */}
          <div className="bg-surface border-2 border-black rounded-sm overflow-x-auto shadow-hard-xl">
            <div className="min-w-[860px] p-4">
              <div
                className="grid gap-1.5 items-center"
                style={{
                  gridTemplateColumns: `135px repeat(${daysInMonth}, minmax(22px, 1fr))`,
                }}
              >
                {/* Day Header Row */}
                <div className="text-[11px] font-extrabold text-ink-secondary uppercase sticky left-0 bg-surface z-10 pr-2 border-r-2 border-black">
                  Meal \ Day →
                </div>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                  const isTodayCol = todayDay === d;
                  return (
                    <div
                      key={`day-head-${d}`}
                      className={`text-center font-mono text-[10px] py-1 font-bold tabular-nums rounded-sm border-2 border-black ${
                        isTodayCol ? 'bg-saffron text-black shadow-hard-sm' : 'bg-surface text-ink-primary'
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
                    <div className="py-2.5 pr-2.5 text-xs font-extrabold text-ink-primary flex flex-col justify-center border-t-2 border-black border-r-2 border-black sticky left-0 bg-surface z-10">
                      <span className="truncate">{type.name}</span>
                      <span className="text-[10px] text-ink-secondary font-mono font-bold truncate">
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
                            className="h-8 rounded-sm bg-surface-subtle border-2 border-black flex items-center justify-center text-[10px] text-ink-muted"
                          >
                            •
                          </div>
                        );
                      }

                      const isClosed = slot.status === 'CLOSED';
                      const isEaten = slot.status === 'EATEN';
                      const isUpcoming = slot.status === 'NOT_YET_SERVED';

                      let cellClass = 'border-2 border-black shadow-hard-sm ';
                      let cellStyle: React.CSSProperties = {};

                      if (isClosed) {
                        cellStyle = {
                          background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 3px, transparent 3px, transparent 6px)',
                        };
                        cellClass += 'text-ink-primary';
                      } else if (isEaten) {
                        cellClass += 'bg-status-success-subtle text-status-success-text hover:translate-x-0.5 hover:translate-y-0.5';
                      } else if (isUpcoming) {
                        cellClass += 'bg-surface border-dashed text-ink-muted hover:border-black';
                      } else {
                        cellClass += 'bg-surface text-ink-muted hover:translate-x-0.5 hover:translate-y-0.5';
                      }

                      if (isTodayCol) {
                        cellClass += ' ring-2 ring-black';
                      }

                      return (
                        <button
                          key={`cell-${type.id}-${d}`}
                          type="button"
                          tabIndex={0}
                          onClick={() => setActiveSlot(slot)}
                          onMouseEnter={() => setActiveSlot(slot)}
                          onFocus={() => setActiveSlot(slot)}
                          className={`h-8 rounded-sm flex items-center justify-center transition-all cursor-pointer focus:outline-none ${cellClass}`}
                          style={cellStyle}
                          aria-label={`Day ${d} ${type.name}: ${
                            isClosed ? `Closed (${slot.closure_reason || 'Maintenance'})` : isEaten ? 'Eaten' : isUpcoming ? 'Upcoming' : 'Missed'
                          }`}
                        >
                          {isClosed ? (
                            <Ban className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
                          ) : isEaten ? (
                            <Check className="w-3.5 h-3.5 text-status-success-text" strokeWidth={3} />
                          ) : isUpcoming ? (
                            <span className="text-[10px] font-bold text-ink-muted">○</span>
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-ink-muted" strokeWidth={2.5} />
                          )}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Interactive Inspector Footer Bar */}
            <div className="px-5 py-3.5 bg-surface-subtle border-t-2 border-black text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              {activeSlot ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-extrabold text-ink-primary">
                    {activeSlot.type_name} • {formatDateIST(activeSlot.meal_date)}
                  </div>
                  <div className="font-medium text-ink-secondary">
                    Window: <span className="font-mono font-bold text-ink-primary">{activeSlot.start_time.slice(0, 5)} - {activeSlot.end_time.slice(0, 5)} IST</span>
                  </div>
                  <div className="font-medium text-ink-secondary">
                    Menu: <span className="font-bold text-ink-primary">{activeSlot.menu}</span>
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
                <div className="text-ink-secondary font-medium italic">
                  Hover or focus on any meal slot above to inspect detailed menu, timing window, and check-in timestamp.
                </div>
              )}

              <div className="text-[11px] text-ink-secondary font-mono font-bold shrink-0">
                IST Timezone (+05:30)
              </div>
            </div>
          </div>

          {/* Quick Counter QR Check-in Box */}
          <div className="p-5 bg-surface border-2 border-black rounded-sm space-y-3 shadow-hard">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-paper text-ink-primary border-2 border-black shadow-hard-sm flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-ink-primary uppercase tracking-wider">
                    Counter QR Check-in
                  </h3>
                  <p className="text-[11px] font-medium text-ink-secondary">
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
              <form onSubmit={handleMarkManual} className="pt-3 border-t-2 border-black flex flex-col sm:flex-row items-center gap-2">
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
          <div className="bg-surface border-2 border-black rounded-sm overflow-hidden shadow-hard-xl space-y-0">
            <div className="px-6 py-4 border-b-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-subtle">
              <div>
                <h2 className="text-base font-heading font-extrabold text-ink-primary">
                  Mess Refund Ledger by Month
                </h2>
                <p className="text-xs font-medium text-ink-secondary">
                  Audited monthly dining rebate records calculated via <code className="font-mono text-[11px] bg-paper border border-black px-1.5 py-0.5 rounded-sm">sp_calculate_refunds</code>.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-ink-primary">
                Statutory Free Skips: {projection?.free_skips ?? 8} meals
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-paper border-b-2 border-black text-ink-primary uppercase font-extrabold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Month</th>
                    <th className="py-3 px-3 text-right">Scheduled</th>
                    <th className="py-3 px-3 text-right">Eaten</th>
                    <th className="py-3 px-3 text-right">Missed</th>
                    <th className="py-3 px-3 text-right">Free Skips</th>
                    <th className="py-3 px-3 text-right">Attendance Refund</th>
                    <th className="py-3 px-3 text-right">Flat Refund</th>
                    <th className="py-3 px-3 text-right">Difference</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black font-mono text-[11px]">
                  {ledgerHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-ink-muted font-sans text-xs font-bold">
                        No refund ledger records found.
                      </td>
                    </tr>
                  ) : (
                    ledgerHistory.map((rec) => {
                      const isPositiveDiff = rec.difference >= 0;
                      return (
                        <tr key={`ledger-${rec.month}-${rec.year}`} className="hover:bg-paper/30 transition-colors">
                          <td className="py-3 px-4 font-sans font-bold text-ink-primary">
                            {rec.monthName}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-ink-secondary font-bold">
                            {rec.scheduled}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-ink-primary font-black">
                            {rec.eaten}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-status-warning-text font-bold">
                            {rec.missed}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-ink-muted font-bold">
                            {rec.freeSkips}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-black text-ink-primary">
                            {formatCurrencyINR(rec.attendanceRefund)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-ink-secondary font-bold">
                            {formatCurrencyINR(rec.flatRefund)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-black">
                            <span className={isPositiveDiff ? 'text-status-success-text' : 'text-status-warning-text'}>
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
            <div className="p-6 bg-surface border-2 border-black rounded-sm space-y-4 shadow-hard-lg">
              <div>
                <span className="text-[10px] font-extrabold text-ink-secondary uppercase tracking-wider">
                  Rebate Formula Walkthrough • {MONTH_NAMES[projection.month]} {projection.year}
                </span>
                <h3 className="text-base font-heading font-extrabold text-ink-primary mt-0.5">
                  Institutional Attendance-Based Rebate Formula
                </h3>
                <p className="text-xs font-medium text-ink-secondary mt-1">
                  Rebate calculation verified per institutional dining statutes with real parameters:
                </p>
              </div>

              {/* Formula Mathematical Display */}
              <div className="p-4 bg-surface-subtle border-2 border-black rounded-sm text-xs font-mono space-y-2 text-ink-primary shadow-hard-sm">
                <div>
                  <strong>Eligible Missed Meals:</strong>{' '}
                  <span className="text-status-success-text font-black">
                    MAX(0, Scheduled ({projection.scheduled}) - Eaten ({projection.eaten}) - Free Skips ({projection.free_skips})) = {projection.eligible_missed} meals
                  </span>
                </div>
                <div>
                  <strong>Raw Calculated Refund:</strong>{' '}
                  <span className="font-bold">
                    {projection.eligible_missed} meals × ₹{projection.per_meal_rate}.00/meal = ₹{(projection.eligible_missed * projection.per_meal_rate).toFixed(2)}
                  </span>
                </div>
                <div>
                  <strong>Policy Ceiling Cap (60% of Food Component):</strong>{' '}
                  <span className="font-bold">
                    60% of ₹{projection.food_component}.00 = ₹{projection.cap_amount}.00
                  </span>
                </div>
                <div className="pt-2 border-t-2 border-black flex justify-between font-extrabold">
                  <span>Final Calculated Rebate:</span>
                  <span className="text-status-success-text text-sm font-black">
                    {formatCurrencyINR(projection.attendance_refund)}
                  </span>
                </div>
              </div>

              {/* Comparison vs Flat Refund */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-sm bg-paper border-2 border-black shadow-hard-sm">
                  <div className="text-[10px] font-extrabold text-ink-secondary uppercase">Attendance Refund</div>
                  <div className="text-lg font-black font-mono text-ink-primary mt-1">
                    {formatCurrencyINR(projection.attendance_refund)}
                  </div>
                  <div className="text-[10px] font-medium text-ink-secondary">Formulated credit</div>
                </div>

                <div className="p-3.5 rounded-sm bg-surface border-2 border-black shadow-hard-sm">
                  <div className="text-[10px] font-extrabold text-ink-secondary uppercase">Historical Flat Benchmark</div>
                  <div className="text-lg font-black font-mono text-ink-secondary mt-1">
                    {formatCurrencyINR(projection.flat_refund)}
                  </div>
                  <div className="text-[10px] font-medium text-ink-secondary">Uniform legacy rate</div>
                </div>

                <div className="p-3.5 rounded-sm bg-surface-subtle border-2 border-black shadow-hard-sm">
                  <div className="text-[10px] font-extrabold text-ink-secondary uppercase">Net Variance</div>
                  <div className={`text-lg font-black font-mono mt-1 ${projection.difference >= 0 ? 'text-status-success-text' : 'text-status-warning-text'}`}>
                    {projection.difference >= 0 ? '+' : ''}{formatCurrencyINR(projection.difference)}
                  </div>
                  <div className="text-[10px] font-medium text-ink-secondary">
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
