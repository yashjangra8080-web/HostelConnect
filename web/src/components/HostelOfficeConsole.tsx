import React, { useState, useEffect } from 'react';
import {
  Play,
  Eye,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { RoomOccupancyBoard } from './RoomOccupancyBoard';
import { ConfirmDialog } from './ui/ConfirmDialog.js';

interface CycleData {
  cycle: {
    cycle_id: number;
    academic_year: string;
    status: 'OPEN' | 'CLOSED' | 'ALLOTTED' | 'PUBLISHED';
    opened_on: string;
    closed_on: string | null;
    published_on: string | null;
    response_deadline: string | null;
  };
  allotments_count: number;
  application_stats: Record<string, number>;
}

interface DryRunSummary {
  total_planned: number;
  allotted_count: number;
  waitlisted_count: number;
  allotted_by_gender: { M: number; F: number };
  allotted_by_habit: { DAY: number; NIGHT: number };
}

export const HostelOfficeConsole: React.FC = () => {
  const [cycleData, setCycleData] = useState<CycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dry-run modal
  const [dryRunResult, setDryRunResult] = useState<{
    summary: DryRunSummary;
    plan: any[];
  } | null>(null);

  // Confirm dialogs
  const [isRunConfirmOpen, setIsRunConfirmOpen] = useState(false);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);

  const fetchCycle = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/allotment/cycle/1');
      if (!res.ok) {
        throw new Error(`Failed to load cycle data (${res.statusText})`);
      }
      const json: CycleData = await res.json();
      setCycleData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycle();
  }, []);

  const handleDryRun = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/allotment/dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Dry-run failed.');
      }
      setDryRunResult({
        summary: data.summary,
        plan: data.plan,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunAllotment = async () => {
    setIsRunConfirmOpen(false);
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const startTime = performance.now();
      const res = await fetch('/api/allotment/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: 1 }),
      });
      const elapsed = Math.round(performance.now() - startTime);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Allotment run failed.');
      }
      setSuccess(`Allotment engine completed in ${elapsed} ms! Allotted ${data.summary?.allotted_count} students.`);
      await fetchCycle();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishConfirmOpen(false);
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/allotment/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Publish failed.');
      }
      setSuccess('Cycle published successfully! Ranking snapshots recorded and student notifications dispatched.');
      await fetchCycle();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const cycleStatus = cycleData?.cycle?.status || 'OPEN';

  const steps = [
    { id: 'OPEN', label: '1. Applications Open', desc: 'Accepting submissions' },
    { id: 'CLOSED', label: '2. Closed / Ready', desc: 'Verification finalized' },
    { id: 'ALLOTTED', label: '3. Allotted', desc: 'Rooms assigned' },
    { id: 'PUBLISHED', label: '4. Published', desc: 'Public pool live' },
  ];

  const getStepState = (stepId: string) => {
    const order = ['OPEN', 'CLOSED', 'ALLOTTED', 'PUBLISHED'];
    const currentIndex = order.indexOf(cycleStatus);
    const stepIndex = order.indexOf(stepId);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="space-y-6">
      {/* Console Header & Stepper Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#0C2054] text-white flex items-center justify-center font-bold text-xs">
                HC
              </div>
              <div>
                <h2 className="text-base font-bold font-heading text-[#0F172A]">Hostel Office Allotment Console</h2>
                <p className="text-xs text-[#64748B]">
                  Academic Year: {cycleData?.cycle?.academic_year || '2026-27'} &bull; Cycle ID: #{cycleData?.cycle?.cycle_id || 1}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={fetchCycle}
            className="p-1.5 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors self-end md:self-auto"
            title="Refresh Cycle"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          </button>
        </div>

        {/* Stepper */}
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {steps.map((st) => {
              const state = getStepState(st.id);
              return (
                <div
                  key={st.id}
                  className={`p-3.5 rounded-lg border transition-colors ${
                    state === 'current'
                      ? 'bg-[#EEF2FF] border-[#2F5BD6] text-[#1E3A8A] ring-1 ring-[#2F5BD6]'
                      : state === 'completed'
                      ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {state === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#059669]" strokeWidth={2} />
                    ) : state === 'current' ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#2F5BD6] animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                    <span className="font-heading font-bold text-xs">{st.label}</span>
                  </div>
                  <p className="text-[11px] mt-1 opacity-80 pl-4">{st.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#DC2626] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-xs text-[#059669] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{success}</span>
          </div>
        )}

        {/* Actions Toolbar */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          {/* Dry Run Button */}
          <button
            onClick={handleDryRun}
            disabled={actionLoading}
            className="px-4 py-2 text-xs font-semibold rounded bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Eye className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
            <span>Preview Dry-Run Allotment</span>
          </button>

          {/* Authoritative Run Button */}
          <button
            onClick={() => setIsRunConfirmOpen(true)}
            disabled={actionLoading || (cycleStatus !== 'CLOSED' && cycleStatus !== 'OPEN')}
            className="px-4 py-2 text-xs font-semibold rounded bg-[#2F5BD6] text-white hover:bg-[#1B43A6] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Play className="w-4 h-4" strokeWidth={1.75} />
            <span>Execute Authoritative Allotment Engine</span>
          </button>

          {/* Publish Button */}
          <button
            onClick={() => setIsPublishConfirmOpen(true)}
            disabled={actionLoading || cycleStatus !== 'ALLOTTED'}
            className="px-4 py-2 text-xs font-semibold rounded bg-[#059669] text-white hover:bg-[#047857] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Send className="w-4 h-4" strokeWidth={1.75} />
            <span>Publish Results to Public Pool</span>
          </button>
        </div>
      </div>

      {/* Embedded Room Occupancy Board */}
      <RoomOccupancyBoard />

      {/* Dry Run Preview Modal */}
      {dryRunResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#EEF2FF] flex items-center justify-center text-[#2F5BD6]">
                  <Eye className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-sm text-[#0F172A]">
                    Dry-Run Allotment Simulation Preview
                  </h3>
                  <p className="text-xs text-[#059669] flex items-center gap-1 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Database rolled back & untouched
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDryRunResult(null)}
                className="p-1 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block">Total Evaluated</span>
                  <span className="text-base font-bold text-[#0F172A] tabular-nums mt-0.5 block">
                    {dryRunResult.summary.total_planned}
                  </span>
                </div>

                <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded">
                  <span className="text-[10px] uppercase font-bold text-[#15803D] block">Allotted Beds</span>
                  <span className="text-base font-bold text-[#15803D] tabular-nums mt-0.5 block">
                    {dryRunResult.summary.allotted_count}
                  </span>
                  <span className="text-[10px] text-[#166534]">
                    ({dryRunResult.summary.allotted_by_gender.M} Boys &bull; {dryRunResult.summary.allotted_by_gender.F} Girls)
                  </span>
                </div>

                <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded">
                  <span className="text-[10px] uppercase font-bold text-[#B45309] block">Waitlisted</span>
                  <span className="text-base font-bold text-[#B45309] tabular-nums mt-0.5 block">
                    {dryRunResult.summary.waitlisted_count}
                  </span>
                </div>

                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block">Habits Allotted</span>
                  <span className="text-xs font-semibold text-[#0F172A] mt-1 block">
                    {dryRunResult.summary.allotted_by_habit.DAY} Day &bull; {dryRunResult.summary.allotted_by_habit.NIGHT} Night
                  </span>
                </div>
              </div>

              {/* Sample Planned Allocation Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                  Sample Planned Allotments (First 20 Records)
                </h4>
                <div className="border border-[#E2E8F0] rounded overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold uppercase text-[#475569]">
                      <tr>
                        <th className="p-2">Rank</th>
                        <th className="p-2">Student</th>
                        <th className="p-2">Gender</th>
                        <th className="p-2">Habit</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Assigned Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {dryRunResult.plan.slice(0, 20).map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC]">
                          <td className="p-2 font-bold tabular-nums">#{p.rank_no}</td>
                          <td className="p-2 font-mono">{p.roll_no}</td>
                          <td className="p-2">{p.gender}</td>
                          <td className="p-2">{p.study_habit}</td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                p.status === 'ALLOTTED'
                                  ? 'bg-[#DCFCE7] text-[#15803D]'
                                  : 'bg-[#FEF3C7] text-[#B45309]'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="p-2 font-medium">
                            {p.room_id ? `Room #${p.room_id}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
              <button
                onClick={() => setDryRunResult(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9]"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Engine Execution Dialog */}
      <ConfirmDialog
        isOpen={isRunConfirmOpen}
        onClose={() => setIsRunConfirmOpen(false)}
        onConfirm={handleRunAllotment}
        title="Execute Authoritative Allotment Engine"
        isDestructive={false}
        isLoading={actionLoading}
        confirmLabel="Execute Engine"
        description={
          <div className="space-y-2 text-xs text-ink-muted">
            <p>
              Are you sure you want to execute the authoritative allotment engine for <strong>Cycle 1</strong>?
            </p>
            <p>
              This will allocate verified applicants into hostel rooms according to the strict 4-tier sort rule (Distance &gt; Category &gt; Merit &gt; Roll Number) and update room occupancy.
            </p>
          </div>
        }
      />

      {/* Confirm Publish Dialog */}
      <ConfirmDialog
        isOpen={isPublishConfirmOpen}
        onClose={() => setIsPublishConfirmOpen(false)}
        onConfirm={handlePublish}
        title="Publish Cycle 1 Allotment Results"
        isDestructive={true}
        isLoading={actionLoading}
        confirmLabel="Publish Results"
        description={
          <div className="space-y-2 text-xs text-ink-muted">
            <p>
              Are you sure you want to publish Cycle 1 allotment results?
            </p>
            <p>
              This irreversible action will snapshot rankings, lock published allotments, notify all students, and activate the 7-day student acceptance deadline.
            </p>
          </div>
        }
      />
    </div>
  );
};
