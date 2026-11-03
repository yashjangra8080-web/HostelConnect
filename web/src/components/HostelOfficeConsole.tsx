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
import { RoomOccupancyBoard } from './RoomOccupancyBoard.js';
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
      <div className="bg-surface border-2 border-black rounded-sm p-6 shadow-hard-lg space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-navy-sidebar text-saffron border-2 border-black shadow-hard-sm flex items-center justify-center font-extrabold font-heading text-sm">
                HC
              </div>
              <div>
                <h2 className="text-xl font-extrabold font-heading text-ink-primary tracking-tight">Hostel Office Allotment Console</h2>
                <p className="text-xs font-medium text-ink-secondary">
                  Academic Year: <span className="font-mono font-bold text-ink-primary">{cycleData?.cycle?.academic_year || '2026-27'}</span> &bull; Cycle ID: <span className="font-mono font-bold text-ink-primary">#{cycleData?.cycle?.cycle_id || 1}</span>
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={fetchCycle}
            className="p-2 rounded-sm text-ink-primary bg-surface hover:bg-paper border-2 border-black shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all self-end md:self-auto"
            title="Refresh Cycle"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
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
                  className={`p-3.5 rounded-sm border-2 border-black transition-all ${
                    state === 'current'
                      ? 'bg-saffron text-black shadow-hard-sm'
                      : state === 'completed'
                      ? 'bg-status-success-subtle text-status-success-text shadow-hard-sm'
                      : 'bg-surface text-ink-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {state === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-status-success-text" strokeWidth={2.5} />
                    ) : state === 'current' ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-surface-muted border border-black" />
                    )}
                    <span className="font-heading font-extrabold text-xs text-ink-primary">{st.label}</span>
                  </div>
                  <p className="text-[11px] font-medium mt-1 pl-4 text-ink-secondary">{st.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 bg-status-danger-subtle border-2 border-black rounded-sm text-xs font-bold text-status-danger-text flex items-center gap-2 shadow-hard-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-status-success-subtle border-2 border-black rounded-sm text-xs font-bold text-status-success-text flex items-center gap-2 shadow-hard-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>{success}</span>
          </div>
        )}

        {/* Actions Toolbar */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          {/* Dry Run Button */}
          <button
            onClick={handleDryRun}
            disabled={actionLoading}
            className="px-4 py-2 text-xs font-extrabold rounded-sm bg-surface border-2 border-black text-ink-primary shadow-hard hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Eye className="w-4 h-4 text-ink-primary" strokeWidth={2} />
            <span>Preview Dry-Run Allotment</span>
          </button>

          {/* Authoritative Run Button */}
          <button
            onClick={() => setIsRunConfirmOpen(true)}
            disabled={actionLoading || (cycleStatus !== 'CLOSED' && cycleStatus !== 'OPEN')}
            className="px-4 py-2 text-xs font-extrabold rounded-sm bg-black text-white border-2 border-black shadow-hard hover:bg-neutral-800 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" strokeWidth={2} />
            <span>Execute Authoritative Allotment Engine</span>
          </button>

          {/* Publish Button */}
          <button
            onClick={() => setIsPublishConfirmOpen(true)}
            disabled={actionLoading || cycleStatus !== 'ALLOTTED'}
            className="px-4 py-2 text-xs font-extrabold rounded-sm bg-saffron text-black border-2 border-black shadow-hard hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" strokeWidth={2} />
            <span>Publish Results to Public Pool</span>
          </button>
        </div>
      </div>

      {/* Embedded Room Occupancy Board */}
      <RoomOccupancyBoard />

      {/* Dry Run Preview Modal */}
      {dryRunResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border-2 border-black rounded-sm shadow-hard-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b-2 border-black flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-sm bg-surface border-2 border-black flex items-center justify-center text-ink-primary shadow-hard-sm">
                  <Eye className="w-4 h-4" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-ink-primary">
                    Dry-Run Allotment Simulation Preview
                  </h3>
                  <p className="text-xs text-status-success-text flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
                    Database rolled back & untouched
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDryRunResult(null)}
                className="p-1 rounded-sm text-ink-primary hover:bg-surface border-2 border-black shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-surface border-2 border-black rounded-sm shadow-hard-sm">
                  <span className="text-[10px] uppercase font-extrabold text-ink-secondary block">Total Evaluated</span>
                  <span className="text-base font-extrabold font-mono text-ink-primary tabular-nums mt-0.5 block">
                    {dryRunResult.summary.total_planned}
                  </span>
                </div>

                <div className="p-3 bg-status-success-subtle border-2 border-black rounded-sm shadow-hard-sm">
                  <span className="text-[10px] uppercase font-extrabold text-status-success-text block">Allotted Beds</span>
                  <span className="text-base font-extrabold font-mono text-status-success-text tabular-nums mt-0.5 block">
                    {dryRunResult.summary.allotted_count}
                  </span>
                  <span className="text-[10px] font-bold text-status-success-text">
                    ({dryRunResult.summary.allotted_by_gender.M} Boys &bull; {dryRunResult.summary.allotted_by_gender.F} Girls)
                  </span>
                </div>

                <div className="p-3 bg-status-warning-subtle border-2 border-black rounded-sm shadow-hard-sm">
                  <span className="text-[10px] uppercase font-extrabold text-status-warning-text block">Waitlisted</span>
                  <span className="text-base font-extrabold font-mono text-status-warning-text tabular-nums mt-0.5 block">
                    {dryRunResult.summary.waitlisted_count}
                  </span>
                </div>

                <div className="p-3 bg-surface border-2 border-black rounded-sm shadow-hard-sm">
                  <span className="text-[10px] uppercase font-extrabold text-ink-secondary block">Habits Allotted</span>
                  <span className="text-xs font-bold text-ink-primary mt-1 block">
                    {dryRunResult.summary.allotted_by_habit.DAY} Day &bull; {dryRunResult.summary.allotted_by_habit.NIGHT} Night
                  </span>
                </div>
              </div>

              {/* Sample Planned Allocation Table */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-ink-secondary mb-2">
                  Sample Planned Allotments (First 20 Records)
                </h4>
                <div className="border-2 border-black rounded-sm overflow-hidden shadow-hard-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-surface-subtle border-b-2 border-black text-[10px] font-extrabold uppercase text-ink-primary">
                      <tr>
                        <th className="p-2.5">Rank</th>
                        <th className="p-2.5">Student</th>
                        <th className="p-2.5">Gender</th>
                        <th className="p-2.5">Habit</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Assigned Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black">
                      {dryRunResult.plan.slice(0, 20).map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-paper/30 transition-colors">
                          <td className="p-2.5 font-extrabold tabular-nums font-mono">#{p.rank_no}</td>
                          <td className="p-2.5 font-mono font-bold text-ink-primary">{p.roll_no}</td>
                          <td className="p-2.5 font-medium">{p.gender}</td>
                          <td className="p-2.5 font-medium">{p.study_habit}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-sm text-[10px] font-extrabold border border-black ${
                                p.status === 'ALLOTTED'
                                  ? 'bg-status-success-subtle text-status-success-text'
                                  : 'bg-status-warning-subtle text-status-warning-text'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="p-2.5 font-bold font-mono">
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
            <div className="px-6 py-3 border-t-2 border-black bg-surface-subtle flex justify-end">
              <button
                onClick={() => setDryRunResult(null)}
                className="px-4 py-1.5 text-xs font-extrabold rounded-sm bg-surface border-2 border-black text-ink-primary shadow-hard-sm hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all"
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
          <div className="space-y-2 text-xs text-ink-secondary">
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
          <div className="space-y-2 text-xs text-ink-secondary">
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
