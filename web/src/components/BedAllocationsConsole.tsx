import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BedDouble, PlayCircle, Eye, CheckCircle2, Search, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button.js';
import { StatusTag } from './ui/StatusTag.js';
import { useToast } from './ui/Toast.js';
import { ErrorState } from './ui/ErrorState.js';

interface AllotmentRow {
  allotment_id: number;
  application_id: number;
  student_id: number;
  cycle_id: number;
  room_id: number;
  response_status: 'AWAITING' | 'ACCEPTED' | 'DECLINED';
  is_published: number;
  allotted_on: string;
  roll_no: string;
  full_name: string;
  gender: 'M' | 'F';
  branch: string;
  merit_rank: number;
  study_habit: 'DAY' | 'NIGHT';
  room_no: string;
  floor_no: number;
  capacity: number;
  study_habit_tag: 'DAY' | 'NIGHT' | null;
  hostel_id: number;
  hostel_name: string;
  gender_type: 'BOYS' | 'GIRLS';
}

interface AllotmentResponse {
  cycle_id: number;
  counts: {
    total: number;
    accepted: number;
    awaiting: number;
    declined: number;
  };
  allotments: AllotmentRow[];
}

export const BedAllocationsConsole: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [cycleId] = useState<number>(1);
  const [selectedHostel, setSelectedHostel] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDryRunModalOpen, setIsDryRunModalOpen] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<any>(null);

  // Fetch allotments
  const { data, isLoading, error, refetch, isFetching } = useQuery<AllotmentResponse>({
    queryKey: ['bed-allocations', cycleId, selectedHostel, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ cycle_id: String(cycleId) });
      if (selectedHostel !== 'ALL') params.append('hostel_id', selectedHostel);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      const res = await fetch(`/api/allotment/list?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load bed allocations (${res.status})`);
      }
      return res.json();
    },
  });

  // Dry run mutation
  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/allotment/dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error?.message || 'Dry run execution failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setDryRunResults(data);
      setIsDryRunModalOpen(true);
      addToast({
        type: 'success',
        title: 'Dry Run Completed',
        description: `Simulated allotment: ${data.summary?.allotted_count || 0} seats planned.`,
      });
    },
    onError: (err: Error) => {
      addToast({
        type: 'danger',
        title: 'Dry Run Error',
        description: err.message,
      });
    },
  });

  // Live run mutation
  const liveRunMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/allotment/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error?.message || 'Live allotment execution failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bed-allocations'] });
      addToast({
        type: 'success',
        title: 'Allotment Engine Executed',
        description: `Successfully generated ${data.summary?.allotted_count || 0} bed allocations.`,
      });
    },
    onError: (err: Error) => {
      addToast({
        type: 'danger',
        title: 'Execution Error',
        description: err.message,
      });
    },
  });

  // Publish cycle mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/allotment/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error?.message || 'Failed to publish cycle');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bed-allocations'] });
      addToast({
        type: 'success',
        title: 'Cycle Published',
        description: 'Allotment results locked and published to students with notification dispatch.',
      });
    },
    onError: (err: Error) => {
      addToast({
        type: 'danger',
        title: 'Publish Error',
        description: err.message,
      });
    },
  });

  const allotments = data?.allotments || [];
  const counts = data?.counts || { total: 0, accepted: 0, awaiting: 0, declined: 0 };

  const filtered = allotments.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      row.roll_no.toLowerCase().includes(term) ||
      row.full_name.toLowerCase().includes(term) ||
      row.room_no.toLowerCase().includes(term) ||
      row.hostel_name.toLowerCase().includes(term)
    );
  });

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <ErrorState
          title="Bed Allocations Offline"
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header card */}
      <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-1.5 bg-paper border-2 border-black rounded-[4px] text-black">
              <BedDouble className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <h1 className="text-2xl font-heading font-extrabold tracking-tight text-black">
              Bed Allocations Console
            </h1>
          </div>
          <p className="text-xs text-black/75 font-medium">
            Review live room assignments, simulate allotment logic with dry-run, execute assignments, and publish official results.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dryRunMutation.mutate()}
            disabled={dryRunMutation.isPending}
            className="flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" />
            <span>{dryRunMutation.isPending ? 'Simulating...' : 'Dry Run'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (window.confirm('Run live allotment engine? This will assign beds to verified applicants according to strict merit rank & distance.')) {
                liveRunMutation.mutate();
              }
            }}
            disabled={liveRunMutation.isPending}
            className="flex items-center gap-1.5"
          >
            <PlayCircle className="w-4 h-4" />
            <span>{liveRunMutation.isPending ? 'Executing...' : 'Run Allotment'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm('Lock and publish cycle results? Students will receive notifications and official admission offers.')) {
                publishMutation.mutate();
              }
            }}
            disabled={publishMutation.isPending}
            className="flex items-center gap-1.5 bg-saffron text-black hover:bg-saffron/90"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{publishMutation.isPending ? 'Publishing...' : 'Publish Results'}</span>
          </Button>
        </div>
      </div>

      {/* KPI stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-black rounded-[4px] p-4 shadow-hard">
          <span className="text-[11px] font-mono font-bold uppercase text-black/60">Total Allotted</span>
          <div className="text-2xl font-heading font-extrabold text-black mt-1">{counts.total}</div>
          <span className="text-xs text-black/70 font-medium">Across all campus hostels</span>
        </div>

        <div className="bg-white border-2 border-black rounded-[4px] p-4 shadow-hard">
          <span className="text-[11px] font-mono font-bold uppercase text-black/60">Awaiting Response</span>
          <div className="text-2xl font-heading font-extrabold text-amber-700 mt-1">{counts.awaiting}</div>
          <span className="text-xs text-black/70 font-medium">Within 7-day acceptance window</span>
        </div>

        <div className="bg-white border-2 border-black rounded-[4px] p-4 shadow-hard">
          <span className="text-[11px] font-mono font-bold uppercase text-black/60">Accepted Offers</span>
          <div className="text-2xl font-heading font-extrabold text-emerald-700 mt-1">{counts.accepted}</div>
          <span className="text-xs text-black/70 font-medium">Confirmed resident beds</span>
        </div>

        <div className="bg-white border-2 border-black rounded-[4px] p-4 shadow-hard">
          <span className="text-[11px] font-mono font-bold uppercase text-black/60">Declined / Vacated</span>
          <div className="text-2xl font-heading font-extrabold text-rose-700 mt-1">{counts.declined}</div>
          <span className="text-xs text-black/70 font-medium">Promoted to waitlisted applicants</span>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white border-2 border-black rounded-[4px] p-4 shadow-hard flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-black/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by roll no, name, room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-paper/30 border-2 border-black rounded-[4px] text-xs font-medium text-black focus:outline-none focus:bg-white"
            />
          </div>

          <select
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(e.target.value)}
            className="px-3 py-1.5 bg-paper/30 border-2 border-black rounded-[4px] text-xs font-bold text-black focus:outline-none focus:bg-white"
          >
            <option value="ALL">All Hostels</option>
            <option value="1">BH1 (Boys Hostel 1)</option>
            <option value="2">BH2 (Boys Hostel 2)</option>
            <option value="3">GH1 (Girls Hostel 1)</option>
            <option value="4">GH2 (Girls Hostel 2)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-paper/30 border-2 border-black rounded-[4px] text-xs font-bold text-black focus:outline-none focus:bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="AWAITING">Awaiting</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="DECLINED">Declined</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <span className="text-xs font-mono font-bold text-black bg-paper px-2.5 py-1 border-2 border-black rounded-[4px]">
            {filtered.length} of {allotments.length} Allotments
          </span>
        </div>
      </div>

      {/* Allocations Table */}
      <div className="bg-white border-2 border-black rounded-[4px] shadow-hard overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-paper border-b-2 border-black font-heading font-extrabold text-black">
              <th className="py-2.5 px-3 border-r-2 border-black">Student Details</th>
              <th className="py-2.5 px-3 border-r-2 border-black">Academic / Rank</th>
              <th className="py-2.5 px-3 border-r-2 border-black">Assigned Room</th>
              <th className="py-2.5 px-3 border-r-2 border-black">Habit Tag</th>
              <th className="py-2.5 px-3 border-r-2 border-black">Status</th>
              <th className="py-2.5 px-3">Allotted Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black/10">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-black/60 font-medium">
                  Loading bed allocations...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-black/60 font-medium">
                  No allocations found matching the current criteria.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.allotment_id} className="hover:bg-paper/20 transition-colors">
                  <td className="py-2.5 px-3 border-r-2 border-black/10">
                    <div className="font-heading font-extrabold text-black">{row.full_name}</div>
                    <div className="font-mono text-[11px] text-black/70">{row.roll_no} • {row.gender === 'M' ? 'Male' : 'Female'}</div>
                  </td>
                  <td className="py-2.5 px-3 border-r-2 border-black/10">
                    <div className="font-bold text-black">{row.branch || 'B.Tech'}</div>
                    <div className="font-mono text-[11px] text-black/70">Merit #{row.merit_rank}</div>
                  </td>
                  <td className="py-2.5 px-3 border-r-2 border-black/10">
                    <div className="font-heading font-extrabold text-black">
                      {row.hostel_name}
                    </div>
                    <div className="font-mono font-bold text-black/80">
                      Room {row.room_no} (Floor {row.floor_no})
                    </div>
                  </td>
                  <td className="py-2.5 px-3 border-r-2 border-black/10">
                    <span className={`inline-block px-2 py-0.5 rounded-[3px] border text-[10px] font-mono font-bold ${
                      row.study_habit === 'DAY'
                        ? 'bg-amber-100 text-amber-900 border-amber-400'
                        : 'bg-indigo-100 text-indigo-900 border-indigo-400'
                    }`}>
                      {row.study_habit}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 border-r-2 border-black/10">
                    <StatusTag
                      status={
                        row.response_status === 'ACCEPTED'
                          ? 'success'
                          : row.response_status === 'AWAITING'
                          ? 'warning'
                          : 'danger'
                      }
                      label={row.response_status}
                      size="sm"
                    />
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-black/75">
                    {new Date(row.allotted_on).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dry Run Modal */}
      {isDryRunModalOpen && dryRunResults && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-[4px] shadow-hard-lg max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-black" />
                <h3 className="font-heading font-extrabold text-lg text-black">Dry-Run Simulation Output</h3>
              </div>
              <Button variant="subtle" size="sm" onClick={() => setIsDryRunModalOpen(false)}>
                ✕
              </Button>
            </div>

            <div className="bg-paper border-2 border-black rounded-[4px] p-4 space-y-2 text-xs">
              <div className="font-bold text-black text-sm">Simulation Summary (Zero DB Writes)</div>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>Total Evaluated: <strong>{dryRunResults.summary?.total_planned || 0}</strong></div>
                <div>Allotted Count: <strong className="text-emerald-800">{dryRunResults.summary?.allotted_count || 0}</strong></div>
                <div>Waitlisted Count: <strong className="text-amber-800">{dryRunResults.summary?.waitlisted_count || 0}</strong></div>
                <div>Day / Night Splits: <strong>{dryRunResults.summary?.allotted_by_habit?.DAY || 0}D / {dryRunResults.summary?.allotted_by_habit?.NIGHT || 0}N</strong></div>
              </div>
            </div>

            <p className="text-xs text-black/75 leading-relaxed font-medium">
              The allocation algorithm tested room compatibility constraints, study-habit matching, gender isolation, and distance priority ranking.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t-2 border-black">
              <Button variant="outline" size="sm" onClick={() => setIsDryRunModalOpen(false)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
