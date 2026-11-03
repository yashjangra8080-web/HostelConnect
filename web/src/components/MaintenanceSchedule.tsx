import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Calendar,
  Clock,
  Building,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
} from 'lucide-react';
import { MaintenanceScheduleItem, MaintenanceType, Role } from '../types';

interface MaintenanceScheduleProps {
  userRole: Role;
  csrfToken?: string;
}

const HOSTEL_TABS = [
  { id: 1, name: 'BH1 (Aryabhatta)', code: 'BH1' },
  { id: 2, name: 'BH2 (Varahamihira)', code: 'BH2' },
  { id: 3, name: 'GH1 (Kalpana Chawla)', code: 'GH1' },
  { id: 4, name: 'GH2 (Gargi)', code: 'GH2' },
];

const MAINT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  MOSQUITO_SPRAY: { bg: 'bg-paper', text: 'text-black' },
  ELECTRICIAN: { bg: 'bg-saffron', text: 'text-black' },
  PLUMBER: { bg: 'bg-surface-subtle', text: 'text-black' },
  TANK_CLEANING: { bg: 'bg-status-success-bg', text: 'text-black' },
  PEST_CONTROL: { bg: 'bg-paper', text: 'text-black' },
};

export const MaintenanceSchedule: React.FC<MaintenanceScheduleProps> = ({ userRole, csrfToken }) => {
  const [selectedHostel, setSelectedHostel] = useState(1);
  const [selectedBlock, setSelectedBlock] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // SEED_TODAY anchor: 2026-11-02 (Monday)
    return new Date('2026-11-02T00:00:00+05:30');
  });

  const [schedules, setSchedules] = useState<MaintenanceScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMaintType, setModalMaintType] = useState<MaintenanceType>('ELECTRICIAN');
  const [modalDate, setModalDate] = useState('2026-11-04');
  const [modalTimeSlot, setModalTimeSlot] = useState('10:00-12:00');
  const [modalBlock, setModalBlock] = useState('A');
  const [modalFloor, setModalFloor] = useState<number | ''>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canManage = ['ADMIN', 'HOSTEL_OFFICE', 'CARETAKER', 'WARDEN', 'CHIEF_WARDEN'].includes(userRole);

  // Build array of 7 consecutive dates for the current view
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const startDate = weekDays[0].toISOString().slice(0, 10);
      const endDate = weekDays[6].toISOString().slice(0, 10);

      const params = new URLSearchParams({
        hostel: selectedHostel.toString(),
        from: startDate,
        to: endDate,
      });
      if (selectedBlock) params.append('block', selectedBlock);

      const res = await fetch(`/api/maintenance/schedule?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error('Failed to load maintenance schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [selectedHostel, selectedBlock, currentWeekStart]);

  const handleStatusChange = async (scheduleId: number, newStatus: 'DONE' | 'CANCELLED') => {
    try {
      const res = await fetch(`/api/maintenance/schedule/${scheduleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchSchedules();
      }
    } catch (err) {
      console.error('Failed to update maintenance task status:', err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/maintenance/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
        body: JSON.stringify({
          hostel_id: selectedHostel,
          maint_type: modalMaintType,
          sched_date: modalDate,
          time_slot: modalTimeSlot.trim() || null,
          block: modalBlock.trim() || null,
          floor_no: modalFloor !== '' ? Number(modalFloor) : null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to create schedule.');
      }

      setShowModal(false);
      fetchSchedules();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeWeek = (offsetDays: number) => {
    const nextD = new Date(currentWeekStart);
    nextD.setDate(nextD.getDate() + offsetDays);
    setCurrentWeekStart(nextD);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-black" strokeWidth={2} />
              <h2 className="text-xl font-heading font-extrabold text-black tracking-tight">Maintenance 7-Day Matrix</h2>
              <span className="text-xs px-2 py-0.5 rounded-[4px] bg-saffron text-black font-heading font-bold border-2 border-black uppercase tracking-wider shadow-hard-sm">
                Block-Level Operations
              </span>
            </div>
            <p className="text-xs text-black/70 font-sans mt-1">
              Scheduled sanitization, mosquito fogging, electrical maintenance, and plumbing overhauls across hostels.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-[8px] text-xs font-heading font-bold border-2 border-black hover:bg-black/80 transition-all shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px]"
            >
              <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
              <span>Schedule Maintenance</span>
            </button>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Hostel Tabs (Authorities only) */}
          {userRole !== 'STUDENT' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {HOSTEL_TABS.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHostel(h.id)}
                  className={`px-3 py-1 text-xs font-heading font-bold rounded-[8px] border-2 border-black transition-colors ${
                    selectedHostel === h.id
                      ? 'bg-black text-white shadow-hard-sm'
                      : 'bg-white text-black hover:bg-saffron'
                  }`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-black/80 flex items-center gap-1.5 font-sans">
              <Building className="w-4 h-4 text-black" strokeWidth={2} />
              <span>Viewing maintenance calendar for your allotted residential wing.</span>
            </div>
          )}

          {/* Block Filter and Week Navigation */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              className="px-2.5 py-1 text-xs border-2 border-black rounded-[8px] bg-white text-black font-heading font-bold shadow-hard-sm focus:outline-none focus:shadow-hard"
            >
              <option value="">All Blocks</option>
              <option value="A">Block A</option>
              <option value="B">Block B</option>
              <option value="Wing-1">Wing-1</option>
              <option value="Wing-2">Wing-2</option>
            </select>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => changeWeek(-7)}
                className="p-1.5 border-2 border-black rounded-[8px] bg-white hover:bg-saffron text-black shadow-hard-sm"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4 text-black" strokeWidth={2} />
              </button>

              <div className="text-xs font-heading font-bold text-black px-3 py-1 bg-white border-2 border-black rounded-[8px] tabular-nums flex items-center gap-1.5 shadow-hard-sm">
                <Calendar className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                <span>
                  {weekDays[0].toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} &ndash;{' '}
                  {weekDays[6].toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <button
                onClick={() => changeWeek(7)}
                className="p-1.5 border-2 border-black rounded-[8px] bg-white hover:bg-saffron text-black shadow-hard-sm"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4 text-black" strokeWidth={2} />
              </button>

              <button
                onClick={() => setCurrentWeekStart(new Date('2026-11-02T00:00:00+05:30'))}
                className="px-2.5 py-1 text-xs font-heading font-bold text-black bg-white hover:bg-paper rounded-[8px] border-2 border-black shadow-hard-sm"
              >
                Current Week
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Grid View */}
      <div className="bg-white border-2 border-black rounded-[4px] shadow-hard-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-black/70 font-sans">
            Loading maintenance schedules...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x-2 divide-black min-h-[360px]">
          {weekDays.map((day, idx) => {
            const dateStr = day.toISOString().slice(0, 10);
            const dayName = day.toLocaleDateString('en-IN', { weekday: 'short' });
            const dayDate = day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

            const dayTasks = schedules.filter((s) => s.sched_date === dateStr);

            return (
              <div key={idx} className="flex flex-col bg-white">
                {/* Day Header */}
                <div className="px-3 py-2.5 bg-surface-subtle border-b-2 border-black text-center">
                  <div className="text-[11px] font-heading font-extrabold text-black uppercase tracking-wider">{dayName}</div>
                  <div className="text-xs font-mono font-bold text-black tabular-nums mt-0.5">{dayDate}</div>
                  <div className="mt-1">
                    <span className="text-[10px] px-1.5 py-0.2 rounded-[4px] font-mono font-bold bg-white text-black border border-black inline-block shadow-hard-sm">
                      {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                </div>

                {/* Day Task Cards */}
                <div className="p-2.5 flex-1 space-y-2 bg-surface-subtle/10">
                  {dayTasks.length === 0 ? (
                    <div className="h-24 flex items-center justify-center text-[11px] text-black/50 font-sans italic">
                      No visits
                    </div>
                  ) : (
                    dayTasks.map((task) => {
                      const color = MAINT_TYPE_COLORS[task.maint_type] || MAINT_TYPE_COLORS.PEST_CONTROL;
                      const isDone = task.status === 'DONE';
                      const isCancelled = task.status === 'CANCELLED';

                      return (
                        <div
                          key={task.schedule_id}
                          className={`p-2.5 rounded-[4px] border-2 border-black bg-white shadow-hard-sm space-y-2 ${
                            isCancelled
                              ? 'opacity-60 bg-status-danger-bg'
                              : isDone
                              ? 'bg-status-success-bg'
                              : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span
                              className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-heading font-bold border-2 border-black uppercase tracking-wider ${color.bg} ${color.text}`}
                            >
                              {task.maint_type.replace('_', ' ')}
                            </span>

                            <span
                              className={`text-[9px] font-heading font-bold px-1.5 py-0.5 rounded-[4px] border border-black uppercase ${
                                isDone
                                  ? 'bg-status-success-bg text-black'
                                  : isCancelled
                                  ? 'bg-status-danger-bg text-black line-through'
                                  : 'bg-saffron text-black'
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>

                          <div className="text-xs font-heading font-bold text-black">
                            Block {task.block || 'All'} {task.floor_no ? `(Flr ${task.floor_no})` : ''}
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-black/70 font-mono tabular-nums">
                            <Clock className="w-3 h-3 text-black" strokeWidth={2} />
                            <span>{task.time_slot || 'All Day'}</span>
                          </div>

                          {/* Quick Actions for Caretakers & Authorities */}
                          {canManage && task.status === 'SCHEDULED' && (
                            <div className="flex items-center gap-1.5 pt-1.5 border-t-2 border-black">
                              <button
                                onClick={() => handleStatusChange(task.schedule_id, 'DONE')}
                                className="flex-1 px-1.5 py-0.5 rounded-[4px] bg-status-success-bg text-black hover:bg-black hover:text-white text-[10px] font-heading font-bold border-2 border-black text-center transition-colors shadow-hard-sm"
                              >
                                Mark Done
                              </button>
                              <button
                                onClick={() => handleStatusChange(task.schedule_id, 'CANCELLED')}
                                className="px-1.5 py-0.5 rounded-[4px] bg-status-danger-bg text-black hover:bg-black hover:text-white text-[10px] font-heading font-bold border-2 border-black text-center transition-colors shadow-hard-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border-2 border-black rounded-[4px] max-w-md w-full p-6 shadow-hard-xl">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
              <h3 className="font-heading font-extrabold text-base text-black">Schedule Maintenance Visit</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-black font-bold"
              >
                <X className="w-5 h-5 text-black" strokeWidth={2} />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-status-danger-bg border-2 border-black rounded-[4px] text-xs text-black flex items-center gap-2 shadow-hard-sm">
                <AlertCircle className="w-4 h-4 shrink-0 text-black" strokeWidth={2} />
                <span className="font-medium font-sans">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-heading font-bold text-black mb-1">Hostel</label>
                  <select
                    value={selectedHostel}
                    onChange={(e) => setSelectedHostel(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-heading font-bold focus:outline-none focus:shadow-hard"
                  >
                    {HOSTEL_TABS.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-heading font-bold text-black mb-1">Task Type</label>
                  <select
                    value={modalMaintType}
                    onChange={(e) => setModalMaintType(e.target.value as MaintenanceType)}
                    className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-heading font-bold focus:outline-none focus:shadow-hard"
                  >
                    <option value="ELECTRICIAN">ELECTRICIAN</option>
                    <option value="PLUMBER">PLUMBER</option>
                    <option value="MOSQUITO_SPRAY">MOSQUITO_SPRAY</option>
                    <option value="TANK_CLEANING">TANK_CLEANING</option>
                    <option value="PEST_CONTROL">PEST_CONTROL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-heading font-bold text-black mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-sans focus:outline-none focus:shadow-hard"
                  />
                </div>

                <div>
                  <label className="block font-heading font-bold text-black mb-1">Time Slot</label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00-12:00"
                    value={modalTimeSlot}
                    onChange={(e) => setModalTimeSlot(e.target.value)}
                    className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-sans focus:outline-none focus:shadow-hard"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-heading font-bold text-black mb-1">Block / Wing</label>
                  <input
                    type="text"
                    placeholder="e.g. A, B, Wing-1"
                    value={modalBlock}
                    onChange={(e) => setModalBlock(e.target.value)}
                    className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-sans focus:outline-none focus:shadow-hard"
                  />
                </div>

                <div>
                  <label className="block font-heading font-bold text-black mb-1">Floor No</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    placeholder="Floor 1, 2, etc."
                    value={modalFloor}
                    onChange={(e) => setModalFloor(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-mono focus:outline-none focus:shadow-hard"
                  />
                </div>
              </div>

              <div className="pt-3 border-t-2 border-black flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border-2 border-black rounded-[8px] font-heading font-bold text-black hover:bg-paper shadow-hard-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-black text-white rounded-[8px] border-2 border-black font-heading font-bold hover:bg-black/80 shadow-hard-sm transition-all active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
                >
                  {submitting ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
