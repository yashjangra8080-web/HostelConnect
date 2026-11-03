import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  HelpCircle,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { PoolResponse, Role } from '../types';
import { RankExplainModal } from './RankExplainModal';

interface PublicPoolProps {
  userRole?: Role;
  userRollNo?: string;
}

export const PublicPool: React.FC<PublicPoolProps> = ({ userRole }) => {
  const [data, setData] = useState<PoolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'DELHI' | 'NON_DELHI'>('ALL');
  const [habitFilter, setHabitFilter] = useState<'ALL' | 'DAY' | 'NIGHT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ALLOTTED' | 'WAITLISTED' | 'PENDING'>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Explain modal state
  const [isExplainOpen, setIsExplainOpen] = useState(false);

  // Fetch public pool
  const fetchPool = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });
      if (search.trim()) params.append('search', search.trim());
      if (genderFilter !== 'ALL') params.append('gender', genderFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (habitFilter !== 'ALL') params.append('habit', habitFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await fetch(`/api/pool?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load pool: ${res.statusText}`);
      }
      const json: PoolResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, genderFilter, priorityFilter, habitFilter, statusFilter]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  // Reset page when filters change
  const handleFilterChange = (setter: (val: any) => void, val: any) => {
    setter(val);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header & Meta Strip */}
      <div className="bg-white border-2 border-black rounded-[4px] p-5 shadow-hard-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[4px] bg-saffron border-2 border-black flex items-center justify-center text-black shadow-hard-sm">
                <Users className="w-4 h-4 text-black" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-heading font-extrabold text-black tracking-tight">Public Merit & Allotment Pool</h2>
                  <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-[4px] bg-status-success-bg text-black border-2 border-black flex items-center gap-1 shadow-hard-sm">
                    <ShieldCheck className="w-3 h-3 text-black" strokeWidth={2} />
                    Zero PII Protected
                  </span>
                </div>
                <p className="text-xs text-black/70 font-sans mt-0.5">
                  Deterministic ranking and allotment pool for NSUT Dwarka. Strictly anonymized.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {userRole === 'STUDENT' && (
              <button
                onClick={() => setIsExplainOpen(true)}
                className="px-3.5 py-1.5 text-xs font-heading font-bold rounded-[8px] bg-black text-white hover:bg-black/80 border-2 border-black transition-all flex items-center gap-1.5 shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px]"
              >
                <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Why is my rank this?</span>
              </button>
            )}

            <button
              onClick={() => fetchPool()}
              className="p-1.5 rounded-[8px] text-black hover:bg-saffron border-2 border-black bg-white transition-colors shadow-hard-sm"
              title="Refresh Pool"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Capacity & Cut-off Meta Stats */}
        {data?.meta && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
            <div className="p-3 bg-surface-subtle/20 border-2 border-black rounded-[4px] shadow-hard-sm">
              <span className="text-[11px] font-heading font-bold text-black uppercase tracking-wider block">
                Boys Capacity & Cut-off
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-heading font-extrabold text-black tabular-nums">
                  #{data.meta.cutoff.M || '—'}
                </span>
                <span className="text-xs text-black/70 font-sans">
                  ({data.meta.capacity.M} total beds)
                </span>
              </div>
            </div>

            <div className="p-3 bg-surface-subtle/20 border-2 border-black rounded-[4px] shadow-hard-sm">
              <span className="text-[11px] font-heading font-bold text-black uppercase tracking-wider block">
                Girls Capacity & Cut-off
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-heading font-extrabold text-black tabular-nums">
                  #{data.meta.cutoff.F || '—'}
                </span>
                <span className="text-xs text-black/70 font-sans">
                  ({data.meta.capacity.F} total beds)
                </span>
              </div>
            </div>

            <div className="p-3 bg-surface-subtle/20 border-2 border-black rounded-[4px] shadow-hard-sm">
              <span className="text-[11px] font-heading font-bold text-black uppercase tracking-wider block">
                Verified Applicants
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-heading font-extrabold text-black tabular-nums">
                  {data.pagination.total}
                </span>
                <span className="text-xs text-black/70 font-sans">in pool</span>
              </div>
            </div>

            <div className="p-3 bg-surface-subtle/20 border-2 border-black rounded-[4px] shadow-hard-sm">
              <span className="text-[11px] font-heading font-bold text-black uppercase tracking-wider block">
                Cycle Status
              </span>
              <div className="mt-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded-[6px] text-xs font-heading font-bold uppercase tracking-wider border-2 border-black ${
                    data.meta.cycle_status === 'PUBLISHED'
                      ? 'bg-status-success-bg text-black'
                      : data.meta.cycle_status === 'ALLOTTED'
                      ? 'bg-saffron text-black'
                      : 'bg-paper text-black'
                  }`}
                >
                  {data.meta.cycle_status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-white border-2 border-black rounded-[4px] p-3 shadow-hard flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-black/60 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={2} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search masked roll no or rank..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border-2 border-black rounded-[8px] text-black font-sans focus:outline-none focus:shadow-hard"
          />
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Gender */}
          <div className="flex items-center gap-1.5 text-xs text-black bg-white border-2 border-black rounded-[8px] px-2.5 py-1 shadow-hard-sm">
            <Filter className="w-3 h-3 text-black" strokeWidth={2} />
            <span className="font-heading font-bold">Gender:</span>
            <select
              value={genderFilter}
              onChange={(e) => handleFilterChange(setGenderFilter, e.target.value)}
              className="bg-transparent font-heading font-bold text-black focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Genders</option>
              <option value="M">Boys (M)</option>
              <option value="F">Girls (F)</option>
            </select>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-1.5 text-xs text-black bg-white border-2 border-black rounded-[8px] px-2.5 py-1 shadow-hard-sm">
            <span className="font-heading font-bold">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => handleFilterChange(setPriorityFilter, e.target.value)}
              className="bg-transparent font-heading font-bold text-black focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Candidates</option>
              <option value="NON_DELHI">Outside Delhi</option>
              <option value="DELHI">Delhi</option>
            </select>
          </div>

          {/* Habit */}
          <div className="flex items-center gap-1.5 text-xs text-black bg-white border-2 border-black rounded-[8px] px-2.5 py-1 shadow-hard-sm">
            <span className="font-heading font-bold">Habit:</span>
            <select
              value={habitFilter}
              onChange={(e) => handleFilterChange(setHabitFilter, e.target.value)}
              className="bg-transparent font-heading font-bold text-black focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Habits</option>
              <option value="DAY">Day Scholar</option>
              <option value="NIGHT">Night Owl</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 text-xs text-black bg-white border-2 border-black rounded-[8px] px-2.5 py-1 shadow-hard-sm">
            <span className="font-heading font-bold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
              className="bg-transparent font-heading font-bold text-black focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ALLOTTED">Allotted</option>
              <option value="WAITLISTED">Waitlisted</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* TanStack-style High-Density Virtual/Paginated Table */}
      <div className="bg-white border-2 border-black rounded-[4px] shadow-hard-xl overflow-hidden">
        {error && (
          <div className="p-4 bg-status-danger-bg border-b-2 border-black text-xs text-black font-medium">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-subtle border-b-2 border-black text-[11px] font-heading font-extrabold uppercase tracking-wider text-black">
                <th className="py-2.5 px-4 w-16">Rank</th>
                <th className="py-2.5 px-4">Masked Roll No</th>
                <th className="py-2.5 px-4">Gender</th>
                <th className="py-2.5 px-4">Priority Group</th>
                <th className="py-2.5 px-4">Distance Band</th>
                <th className="py-2.5 px-4">Study Habit</th>
                <th className="py-2.5 px-4">Allotment Status</th>
                <th className="py-2.5 px-4 text-right">Quota Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black text-xs">
              {loading && (!data || data.data.length === 0) ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-black/70 font-sans">
                    Loading public pool records...
                  </td>
                </tr>
              ) : !data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-black/70 font-sans">
                    No applicants found matching filter criteria.
                  </td>
                </tr>
              ) : (
                data.data.map((row, index) => {
                  const prevRow = index > 0 ? data.data[index - 1] : null;
                  // Show cut-off line if this row crosses the cut-off rank for its gender
                  const isCutoffBoundary =
                    row.gender_cutoff_rank !== null &&
                    ((prevRow && prevRow.rank_no <= row.gender_cutoff_rank && row.rank_no > row.gender_cutoff_rank) ||
                      (index === 0 && row.rank_no > row.gender_cutoff_rank && page === 1));

                  return (
                    <React.Fragment key={`${row.cycle_id}-${row.rank_no}-${row.masked_roll_no}`}>
                      {/* Saffron Cut-Off Divider Line */}
                      {isCutoffBoundary && (
                        <tr className="bg-saffron border-y-2 border-black">
                          <td colSpan={8} className="py-2 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="w-12 h-[2px] bg-black"></span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-[4px] text-[11px] font-heading font-extrabold uppercase tracking-wider bg-black text-white border-2 border-black shadow-hard-sm">
                                <Award className="w-3.5 h-3.5" strokeWidth={2} />
                                <span>
                                  {row.gender === 'M' ? 'Boys' : 'Girls'} Cut-Off Line — Rank #{row.gender_cutoff_rank}
                                </span>
                              </span>
                              <span className="text-[11px] text-black font-heading font-bold">
                                (Applicants below this line are Waitlisted)
                              </span>
                              <span className="w-12 h-[2px] bg-black"></span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Regular Table Row */}
                      <tr
                        className={`transition-colors text-black ${
                          row.is_me
                            ? 'bg-paper font-bold border-l-4 border-l-black'
                            : 'hover:bg-paper'
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-2.5 px-4 tabular-nums">
                          <span
                            className={`inline-flex items-center justify-center font-mono font-bold px-2 py-0.5 rounded-[4px] border-2 border-black ${
                              row.rank_no <= 3
                                ? 'bg-saffron text-black shadow-hard-sm'
                                : 'bg-white text-black'
                            }`}
                          >
                            #{row.rank_no}
                          </span>
                        </td>

                        {/* Masked Roll No */}
                        <td className="py-2.5 px-4 font-mono font-bold flex items-center gap-2">
                          <span>{row.masked_roll_no}</span>
                          {row.is_me && (
                            <span className="px-1.5 py-0.2 rounded-[4px] text-[10px] font-heading font-extrabold bg-black text-white border border-black shadow-hard-sm">
                              YOU
                            </span>
                          )}
                        </td>

                        {/* Gender */}
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold bg-surface-subtle text-black border-2 border-black">
                            {row.gender === 'M' ? 'Boys (M)' : 'Girls (F)'}
                          </span>
                        </td>

                        {/* Priority Group */}
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold border-2 border-black ${
                              row.is_delhi_candidate === 0
                                ? 'bg-saffron text-black'
                                : 'bg-white text-black'
                            }`}
                          >
                            {row.priority_group}
                          </span>
                        </td>

                        {/* Distance Band */}
                        <td className="py-2.5 px-4 tabular-nums font-mono">
                          <span className="font-bold text-black">Band {row.distance_band}</span>
                          <span className="text-[11px] text-black/70 ml-1">({row.distance_km} km)</span>
                        </td>

                        {/* Study Habit */}
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold border-2 border-black ${
                              row.study_habit === 'DAY'
                                ? 'bg-paper text-black'
                                : 'bg-surface-subtle text-black'
                            }`}
                          >
                            {row.study_habit === 'DAY' ? (
                              <Sun className="w-3 h-3 text-black" strokeWidth={2} />
                            ) : (
                              <Moon className="w-3 h-3 text-black" strokeWidth={2} />
                            )}
                            {row.study_habit === 'DAY' ? 'Day Scholar' : 'Night Owl'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold uppercase tracking-wider border-2 border-black ${
                              row.application_status === 'ALLOTTED'
                                ? 'bg-status-success-bg text-black'
                                : row.application_status === 'WAITLISTED'
                                ? 'bg-status-danger-bg text-black'
                                : 'bg-paper text-black'
                            }`}
                          >
                            {row.application_status}
                          </span>
                        </td>

                        {/* Quota Position */}
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {row.is_seated ? (
                            <span className="text-black font-heading font-bold text-[11px] bg-status-success-bg px-2 py-0.5 rounded-[4px] border-2 border-black inline-block">
                              Within Seated Quota
                            </span>
                          ) : (
                            <span className="text-black font-heading font-bold text-[11px] bg-status-danger-bg px-2 py-0.5 rounded-[4px] border-2 border-black inline-block">
                              Waitlist (Cutoff #{row.gender_cutoff_rank})
                            </span>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {data?.pagination && (
          <div className="px-4 py-3 bg-surface-subtle/20 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-black">
            <div>
              Showing{' '}
              <span className="font-bold text-black tabular-nums">
                {(data.pagination.page - 1) * data.pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-bold text-black tabular-nums">
                {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)}
              </span>{' '}
              of{' '}
              <span className="font-bold text-black tabular-nums">
                {data.pagination.total}
              </span>{' '}
              applicants
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-bold">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white border-2 border-black rounded-[8px] px-2 py-1 font-heading font-bold text-black focus:outline-none shadow-hard-sm"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={data.pagination.page <= 1 || loading}
                  className="p-1 rounded-[8px] border-2 border-black bg-white text-black hover:bg-saffron disabled:opacity-40 disabled:cursor-not-allowed shadow-hard-sm"
                >
                  <ChevronLeft className="w-4 h-4 text-black" strokeWidth={2} />
                </button>
                <span className="px-2 font-mono font-bold tabular-nums">
                  Page {data.pagination.page} of {data.pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, data.pagination.totalPages))}
                  disabled={data.pagination.page >= data.pagination.totalPages || loading}
                  className="p-1 rounded-[8px] border-2 border-black bg-white text-black hover:bg-saffron disabled:opacity-40 disabled:cursor-not-allowed shadow-hard-sm"
                >
                  <ChevronRight className="w-4 h-4 text-black" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Why is my rank this? Modal */}
      <RankExplainModal isOpen={isExplainOpen} onClose={() => setIsExplainOpen(false)} />
    </div>
  );
};
