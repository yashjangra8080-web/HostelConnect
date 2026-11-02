import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Calendar,
  Clock,
  Plus,
  Building,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { MaintenanceScheduleItem, MaintenanceType, MaintenanceStatus, Role } from '../types';

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

const MAINT_TYPE_COLORS: Record<MaintenanceType, { bg: string; text: string; border: string }> = {
  MOSQUITO_SPRAY: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  ELECTRICIAN: { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' },
  PLUMBER: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  TANK_CLEANING: { bg: '#ECFEFF', text: '#0891B2', border: '#A5F3FC' },
  PEST_CONTROL: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
};

export const MaintenanceSchedule: React.FC<MaintenanceScheduleProps> = ({ userRole, csrfToken }) => {
  const [selectedHostel, setSelectedHostel] = useState(1);
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    // Seed maintenance dates are around Nov 05 - Nov 12, 2026. Let's start week on 2026-11-02 (Monday)
    return new Date('2026-11-02T00:00:00+05:30');
  });
  const [schedules, setSchedules] = useState<MaintenanceScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMaintType, setModalMaintType] = useState<MaintenanceType>('ELECTRICIAN');
  const [modalDate, setModalDate] = useState('2026-11-05');
  const [modalTimeSlot, setModalTimeSlot] = useState('10:00-12:00');
  const [modalBlock, setModalBlock] = useState('A');
  const [modalFloor, setModalFloor] = useState<number | ''>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canManage = ['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'CARETAKER'].includes(userRole);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const weekStr = currentWeekStart.toISOString().slice(0, 10);
      const params = new URLSearchParams();
      if (userRole !== 'STUDENT') {
        params.set('hostel_id', String(selectedHostel));
      }
      if (selectedBlock) {
        params.set('block', selectedBlock);
      }
      params.set('week_start', weekStr);

      const res = await fetch(`/api/maintenance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error('Failed fetching maintenance schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [selectedHostel, selectedBlock, currentWeekStart]);

  // Generate 7 days for the current week
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const handleStatusChange = async (scheduleId: number, newStatus: MaintenanceStatus) => {
    try {
      const res = await fetch(`/api/maintenance/${scheduleId}`, {
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
      console.error('Failed to update maintenance status:', err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
        body: JSON.stringify({
          hostel_id: selectedHostel,
          maint_type: modalMaintType,
          block: modalBlock || null,
          floor_no: modalFloor !== '' ? Number(modalFloor) : null,
          sched_date: modalDate,
          time_slot: modalTimeSlot || null,
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
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-[#2F5BD6]" strokeWidth={1.75} />
              <h2 className="text-xl font-bold font-heading text-[#0F172A]">Maintenance 7-Day Matrix</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#2F5BD6] font-semibold border border-[#CBD5E1]">
                Block-Level Operations
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Scheduled sanitization, mosquito fogging, electrical maintenance, and plumbing overhauls across hostels.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2F5BD6] text-white rounded text-xs font-semibold hover:bg-[#1B43A6] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
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
                  className={`px-3 py-1 text-xs font-semibold rounded border transition-colors ${
                    selectedHostel === h.id
                      ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                      : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[#475569] flex items-center gap-1.5">
              <Building className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
              <span>Viewing maintenance calendar for your allotted residential wing.</span>
            </div>
          )}

          {/* Block Filter and Week Navigation */}
          <div className="flex items-center gap-3">
            <select
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              className="px-2.5 py-1 text-xs border border-[#CBD5E1] rounded bg-white text-[#0F172A] focus:outline-none focus:border-[#2F5BD6]"
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
                className="p-1.5 border border-[#CBD5E1] rounded bg-white hover:bg-[#F8FAFC] text-[#475569]"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
              </button>

              <div className="text-xs font-bold text-[#0F172A] px-3 py-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded tabular-nums flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#2F5BD6]" strokeWidth={1.75} />
                <span>
                  {weekDays[0].toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} &ndash;{' '}
                  {weekDays[6].toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <button
                onClick={() => changeWeek(7)}
                className="p-1.5 border border-[#CBD5E1] rounded bg-white hover:bg-[#F8FAFC] text-[#475569]"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>

              <button
                onClick={() => setCurrentWeekStart(new Date('2026-11-02T00:00:00+05:30'))}
                className="px-2.5 py-1 text-xs font-semibold text-[#2F5BD6] hover:bg-[#EEF2FF] rounded border border-[#CBD5E1]"
              >
                Current Week
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Grid View */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#64748B]">
            Loading maintenance schedules...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-[#E2E8F0] min-h-[360px]">
          {weekDays.map((day, idx) => {
            const dateStr = day.toISOString().slice(0, 10);
            const dayName = day.toLocaleDateString('en-IN', { weekday: 'short' });
            const dayDate = day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

            const dayTasks = schedules.filter((s) => s.sched_date === dateStr);

            return (
              <div key={idx} className="flex flex-col bg-white">
                {/* Day Header */}
                <div className="px-3 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] text-center">
                  <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{dayName}</div>
                  <div className="text-xs font-semibold text-[#0F172A] tabular-nums mt-0.5">{dayDate}</div>
                  <div className="mt-1">
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-semibold bg-[#EEF2FF] text-[#2F5BD6] tabular-nums">
                      {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                </div>

                {/* Day Task Cards */}
                <div className="p-2.5 flex-1 space-y-2 bg-[#FBFBFE]/50">
                  {dayTasks.length === 0 ? (
                    <div className="h-24 flex items-center justify-center text-[11px] text-[#94A3B8] italic">
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
                          className={`p-2.5 rounded border bg-white shadow-2xs transition-all ${
                            isCancelled
                              ? 'opacity-60 border-[#FECACA] bg-[#FEF2F2]/30'
                              : isDone
                              ? 'border-[#A7F3D0] bg-[#ECFDF5]/30'
                              : 'border-[#CBD5E1]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider"
                              style={{
                                backgroundColor: color.bg,
                                color: color.text,
                                borderColor: color.border,
                              }}
                            >
                              {task.maint_type.replace('_', ' ')}
                            </span>

                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                isDone
                                  ? 'bg-[#ECFDF5] text-[#059669]'
                                  : isCancelled
                                  ? 'bg-[#FEF2F2] text-[#DC2626] line-through'
                                  : 'bg-[#EFF6FF] text-[#2F5BD6]'
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>

                          <div className="text-xs font-semibold text-[#0F172A] mb-1">
                            Block {task.block || 'All'} {task.floor_no ? `(Flr ${task.floor_no})` : ''}
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-[#64748B] tabular-nums mb-2">
                            <Clock className="w-3 h-3 text-[#94A3B8]" strokeWidth={1.75} />
                            <span>{task.time_slot || 'All Day'}</span>
                          </div>

                          {/* Quick Actions for Caretakers & Authorities */}
                          {canManage && task.status === 'SCHEDULED' && (
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-dashed border-[#E2E8F0]">
                              <button
                                onClick={() => handleStatusChange(task.schedule_id, 'DONE')}
                                className="flex-1 px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5] text-[10px] font-semibold border border-[#A7F3D0] text-center"
                              >
                                Mark Done
                              </button>
                              <button
                                onClick={() => handleStatusChange(task.schedule_id, 'CANCELLED')}
                                className="px-1.5 py-0.5 rounded bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] text-[10px] font-semibold border border-[#FECACA] text-center"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
              <h3 className="font-bold text-base text-[#0F172A]">Schedule Maintenance Visit</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-xs text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Hostel</label>
                  <select
                    value={selectedHostel}
                    onChange={(e) => setSelectedHostel(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6] bg-white"
                  >
                    {HOSTEL_TABS.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Task Type</label>
                  <select
                    value={modalMaintType}
                    onChange={(e) => setModalMaintType(e.target.value as MaintenanceType)}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6] bg-white"
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
                  <label className="block font-semibold text-[#0F172A] mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Time Slot</label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00-12:00"
                    value={modalTimeSlot}
                    onChange={(e) => setModalTimeSlot(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Block / Wing</label>
                  <input
                    type="text"
                    placeholder="e.g. A, B, Wing-1"
                    value={modalBlock}
                    onChange={(e) => setModalBlock(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Floor No</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    placeholder="Floor 1, 2, etc."
                    value={modalFloor}
                    onChange={(e) => setModalFloor(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[#CBD5E1] rounded font-medium text-[#475569] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#2F5BD6] text-white rounded font-semibold hover:bg-[#1B43A6] disabled:opacity-50"
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
