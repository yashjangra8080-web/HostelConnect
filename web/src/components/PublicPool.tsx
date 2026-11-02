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
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#EEF2FF] flex items-center justify-center text-[#2F5BD6]">
                <Users className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold font-heading text-[#0F172A]">Public Merit & Allotment Pool</h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" strokeWidth={1.75} />
                    Zero PII Protected
                  </span>
                </div>
                <p className="text-xs text-[#64748B]">
                  Deterministic ranking and allotment pool for NSUT Dwarka. Strictly anonymized.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {userRole === 'STUDENT' && (
              <button
                onClick={() => setIsExplainOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#2F5BD6] text-white hover:bg-[#1B43A6] transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Why is my rank this?</span>
              </button>
            )}

            <button
              onClick={() => fetchPool()}
              className="p-1.5 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors"
              title="Refresh Pool"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Capacity & Cut-off Meta Stats */}
        {data?.meta && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                Boys Capacity & Cut-off
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-bold text-[#0F172A] tabular-nums">
                  #{data.meta.cutoff.M || '—'}
                </span>
                <span className="text-xs text-[#64748B]">
                  ({data.meta.capacity.M} total beds)
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                Girls Capacity & Cut-off
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-bold text-[#0F172A] tabular-nums">
                  #{data.meta.cutoff.F || '—'}
                </span>
                <span className="text-xs text-[#64748B]">
                  ({data.meta.capacity.F} total beds)
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                Verified Applicants
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-bold text-[#0F172A] tabular-nums">
                  {data.pagination.total}
                </span>
                <span className="text-xs text-[#64748B]">in pool</span>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                Cycle Status
              </span>
              <div className="mt-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                    data.meta.cycle_status === 'PUBLISHED'
                      ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                      : data.meta.cycle_status === 'ALLOTTED'
                      ? 'bg-[#EEF2FF] text-[#2F5BD6] border border-[#CBD5E1]'
                      : 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
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
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search masked roll no or rank..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:bg-white focus:outline-none focus:border-[#2F5BD6] transition-colors"
          />
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Gender */}
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded px-2.5 py-1">
            <Filter className="w-3 h-3 text-[#2F5BD6]" strokeWidth={1.75} />
            <span className="font-medium">Gender:</span>
            <select
              value={genderFilter}
              onChange={(e) => handleFilterChange(setGenderFilter, e.target.value)}
              className="bg-transparent font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Genders</option>
              <option value="M">Boys (M)</option>
              <option value="F">Girls (F)</option>
            </select>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded px-2.5 py-1">
            <span className="font-medium">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => handleFilterChange(setPriorityFilter, e.target.value)}
              className="bg-transparent font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Candidates</option>
              <option value="NON_DELHI">Outside Delhi</option>
              <option value="DELHI">Delhi</option>
            </select>
          </div>

          {/* Habit */}
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded px-2.5 py-1">
            <span className="font-medium">Habit:</span>
            <select
              value={habitFilter}
              onChange={(e) => handleFilterChange(setHabitFilter, e.target.value)}
              className="bg-transparent font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Habits</option>
              <option value="DAY">Day Scholar</option>
              <option value="NIGHT">Night Owl</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded px-2.5 py-1">
            <span className="font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
              className="bg-transparent font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
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
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-[#FEF2F2] border-b border-[#FECACA] text-xs text-[#DC2626]">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-[#475569]">
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
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {loading && (!data || data.data.length === 0) ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-[#64748B]">
                    Loading public pool records...
                  </td>
                </tr>
              ) : !data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-[#64748B]">
                    No applicants found matching filter criteria.
                  </td>
                </tr>
              ) : (
                data.data.map((row, index) => {
                  const prevRow = index > 0 ? data.data[index - 1] : null;
                  // Show saffron line if this row crosses the cut-off rank for its gender
                  const isCutoffBoundary =
                    row.gender_cutoff_rank !== null &&
                    ((prevRow && prevRow.rank_no <= row.gender_cutoff_rank && row.rank_no > row.gender_cutoff_rank) ||
                      (index === 0 && row.rank_no > row.gender_cutoff_rank && page === 1));

                  return (
                    <React.Fragment key={`${row.cycle_id}-${row.rank_no}-${row.masked_roll_no}`}>
                      {/* Saffron Cut-Off Divider Line */}
                      {isCutoffBoundary && (
                        <tr className="bg-[#FFF7ED] border-y-2 border-[#FF9933]">
                          <td colSpan={8} className="py-2 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="w-12 h-[2px] bg-[#FF9933]"></span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#FF9933] text-white shadow-sm">
                                <Award className="w-3.5 h-3.5" strokeWidth={2} />
                                <span>
                                  {row.gender === 'M' ? 'Boys' : 'Girls'} Cut-Off Line — Rank #{row.gender_cutoff_rank}
                                </span>
                              </span>
                              <span className="text-[11px] text-[#C2410C] font-semibold">
                                (Applicants below this line are Waitlisted)
                              </span>
                              <span className="w-12 h-[2px] bg-[#FF9933]"></span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Regular Table Row */}
                      <tr
                        className={`transition-colors ${
                          row.is_me
                            ? 'bg-[#EEF2FF] font-semibold border-l-4 border-l-[#2F5BD6]'
                            : row.is_seated
                            ? 'hover:bg-[#F8FAFC]'
                            : 'hover:bg-[#F8FAFC] opacity-90'
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-2.5 px-4 tabular-nums">
                          <span
                            className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded ${
                              row.rank_no <= 3
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : row.is_seated
                                ? 'text-[#0F172A]'
                                : 'text-[#64748B]'
                            }`}
                          >
                            #{row.rank_no}
                          </span>
                        </td>

                        {/* Masked Roll No */}
                        <td className="py-2.5 px-4 font-mono font-medium flex items-center gap-2">
                          <span>{row.masked_roll_no}</span>
                          {row.is_me && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#2F5BD6] text-white">
                              YOU
                            </span>
                          )}
                        </td>

                        {/* Gender */}
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0]">
                            {row.gender === 'M' ? 'Boys (M)' : 'Girls (F)'}
                          </span>
                        </td>

                        {/* Priority Group */}
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              row.is_delhi_candidate === 0
                                ? 'bg-[#EEF2FF] text-[#2F5BD6] border border-[#CBD5E1]'
                                : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]'
                            }`}
                          >
                            {row.priority_group}
                          </span>
                        </td>

                        {/* Distance Band */}
                        <td className="py-2.5 px-4 tabular-nums">
                          <span className="font-medium text-[#0F172A]">Band {row.distance_band}</span>
                          <span className="text-[11px] text-[#64748B] ml-1">({row.distance_km} km)</span>
                        </td>

                        {/* Study Habit */}
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                              row.study_habit === 'DAY'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {row.study_habit === 'DAY' ? (
                              <Sun className="w-3 h-3" strokeWidth={1.75} />
                            ) : (
                              <Moon className="w-3 h-3" strokeWidth={1.75} />
                            )}
                            {row.study_habit === 'DAY' ? 'Day Scholar' : 'Night Owl'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                              row.application_status === 'ALLOTTED'
                                ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                                : row.application_status === 'WAITLISTED'
                                ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                                : 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'
                            }`}
                          >
                            {row.application_status}
                          </span>
                        </td>

                        {/* Quota Position */}
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {row.is_seated ? (
                            <span className="text-[#059669] font-medium text-[11px]">
                              Within Seated Quota
                            </span>
                          ) : (
                            <span className="text-[#D97706] font-medium text-[11px]">
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
          <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B]">
            <div>
              Showing{' '}
              <span className="font-semibold text-[#0F172A] tabular-nums">
                {(data.pagination.page - 1) * data.pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-[#0F172A] tabular-nums">
                {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-[#0F172A] tabular-nums">
                {data.pagination.total}
              </span>{' '}
              applicants
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white border border-[#CBD5E1] rounded px-2 py-1 font-semibold text-[#0F172A] focus:outline-none"
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
                  className="p-1 rounded border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <span className="px-2 font-medium tabular-nums">
                  Page {data.pagination.page} of {data.pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, data.pagination.totalPages))}
                  disabled={data.pagination.page >= data.pagination.totalPages || loading}
                  className="p-1 rounded border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
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
