import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Download,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  MapPin,
} from 'lucide-react';
import { Application, KeysetResponse } from '../types';

interface VerificationQueueProps {
  onRefreshKpis?: () => void;
}

export const VerificationQueue: React.FC<VerificationQueueProps> = ({ onRefreshKpis }) => {
  // Read initial filters from URL search params
  const getInitialFilters = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      status: params.get('status') || 'PENDING', // Default to PENDING for the queue
      band: params.get('band') || '',
      gender: params.get('gender') || '',
      schooling: params.get('schooling') || '',
      branch: params.get('branch') || '',
      search: params.get('search') || '',
      sortBy: params.get('sort_by') || 'distance_km',
      sortOrder: params.get('sort_order') || 'desc',
    };
  };

  const [filters, setFilters] = useState(getInitialFilters);
  const [searchInput, setSearchInput] = useState(filters.search);

  // Pagination & Keyset state
  const [data, setData] = useState<KeysetResponse<Application> | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  // Selection & Bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    decision: 'VERIFIED' | 'REJECTED';
    ids: number[];
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync state changes to browser URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.band) params.set('band', filters.band);
    if (filters.gender) params.set('gender', filters.gender);
    if (filters.schooling) params.set('schooling', filters.schooling);
    if (filters.branch) params.set('branch', filters.branch);
    if (filters.search) params.set('search', filters.search);
    if (filters.sortBy !== 'distance_km') params.set('sort_by', filters.sortBy);
    if (filters.sortOrder !== 'desc') params.set('sort_order', filters.sortOrder);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [filters]);

  // Fetch applications whenever filters or cursor change
  const fetchApplications = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('cycle_id', '1');
      q.set('limit', '50');
      q.set('sort_by', filters.sortBy);
      q.set('sort_order', filters.sortOrder);

      if (filters.status && filters.status !== 'ALL') {
        q.set('verification_status', filters.status);
      }
      if (filters.band) {
        q.set('distance_band', filters.band);
      }
      if (filters.gender) {
        q.set('gender', filters.gender);
      }
      if (filters.schooling) {
        q.set('schooling_state', filters.schooling);
      }
      if (filters.branch) {
        q.set('branch', filters.branch);
      }
      if (filters.search) {
        q.set('search', filters.search);
      }
      if (currentCursor) {
        q.set('cursor', currentCursor);
      }

      const res = await fetch(`/api/applications?${q.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: KeysetResponse<Application> = await res.json();
      setData(json);
      setSelectedIds([]);
    } catch (err: any) {
      console.error('Failed fetching applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [filters, currentCursor]);

  // Handle single and bulk verify/reject
  const handleVerifyDecision = async (decision: 'VERIFIED' | 'REJECTED', ids: number[]) => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      let res;
      if (ids.length === 1) {
        res = await fetch('/api/applications/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ application_id: ids[0], decision }),
        });
      } else {
        res = await fetch('/api/applications/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ application_ids: ids, decision }),
        });
      }

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Verification failed');

      setStatusMessage({
        text: result.message || `Successfully marked as ${decision}.`,
        type: 'success',
      });
      setConfirmDialog(null);
      fetchApplications();
      if (onRefreshKpis) onRefreshKpis();
    } catch (err: any) {
      setStatusMessage({
        text: err.message || 'Error occurred while verifying.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const q = new URLSearchParams();
    q.set('cycle_id', '1');
    if (filters.status && filters.status !== 'ALL') q.set('verification_status', filters.status);
    if (filters.band) q.set('distance_band', filters.band);
    if (filters.gender) q.set('gender', filters.gender);
    if (filters.schooling) q.set('schooling_state', filters.schooling);
    if (filters.branch) q.set('branch', filters.branch);
    if (filters.search) q.set('search', filters.search);
    q.set('sort_by', filters.sortBy);
    q.set('sort_order', filters.sortOrder);

    window.open(`/api/applications/export?${q.toString()}`, '_blank');
  };

  // Checkbox helpers
  const allCurrentPageSelected = useMemo(() => {
    if (!data?.items || data.items.length === 0) return false;
    return data.items.every((a) => selectedIds.includes(a.application_id));
  }, [data, selectedIds]);

  const toggleSelectAll = () => {
    if (!data?.items) return;
    if (allCurrentPageSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.items.map((a) => a.application_id));
    }
  };

  const toggleSelectRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({
      status: 'ALL',
      band: '',
      gender: '',
      schooling: '',
      branch: '',
      search: '',
      sortBy: 'distance_km',
      sortOrder: 'desc',
    });
    setSearchInput('');
    setCurrentCursor(null);
    setCursorStack([]);
  };

  return (
    <div className="space-y-4">
      {/* Notifications banner */}
      {statusMessage && (
        <div
          className={`px-4 py-2.5 rounded text-xs font-medium border flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
              : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* FilterBar & URL Chips */}
      <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-sm space-y-3">
        {/* Top search & quick actions row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                strokeWidth={1.75}
              />
              <input
                type="text"
                placeholder="Search by student name or roll number (e.g. 2026UCS...)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setFilters((prev) => ({ ...prev, search: searchInput }));
                    setCurrentCursor(null);
                    setCursorStack([]);
                  }
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F5BD6]"
              />
            </div>
            <button
              onClick={() => {
                setFilters((prev) => ({ ...prev, search: searchInput }));
                setCurrentCursor(null);
                setCursorStack([]);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-[#2F5BD6] text-white rounded hover:bg-[#1B43A6] transition-colors"
            >
              Search
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-[#CBD5E1] text-[#0F172A] rounded hover:bg-[#F8FAFC] flex items-center gap-1.5 transition-colors"
              title="Export current filtered view to CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#2F5BD6]" strokeWidth={1.75} />
              <span>Export CSV</span>
            </button>
            {(filters.status !== 'ALL' ||
              filters.band ||
              filters.gender ||
              filters.schooling ||
              filters.branch ||
              filters.search) && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 text-xs text-[#DC2626] hover:bg-[#FEF2F2] rounded flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* FilterBar Chips Rows */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-[#E2E8F0] text-xs">
          {/* Status chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#64748B] font-medium text-[11px] uppercase tracking-wider">Status:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'PENDING', label: 'Pending' },
              { id: 'VERIFIED', label: 'Verified' },
              { id: 'REJECTED', label: 'Rejected' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, status: st.id }));
                  setCurrentCursor(null);
                  setCursorStack([]);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  filters.status === st.id
                    ? 'bg-[#1E3A8A] text-white'
                    : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:bg-[#EEF2FF]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Distance Band chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#64748B] font-medium text-[11px] uppercase tracking-wider">Band:</span>
            {[
              { id: '', label: 'All Bands' },
              { id: '1', label: 'Band 1 (<200km)' },
              { id: '2', label: 'Band 2 (200-499km)' },
              { id: '3', label: 'Band 3 (500-999km)' },
              { id: '4', label: 'Band 4 (≥1000km)' },
            ].map((bd) => (
              <button
                key={bd.id}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, band: bd.id }));
                  setCurrentCursor(null);
                  setCursorStack([]);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  filters.band === bd.id
                    ? 'bg-[#2F5BD6] text-white'
                    : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:bg-[#EEF2FF]'
                }`}
              >
                {bd.label}
              </button>
            ))}
          </div>

          {/* Delhi Priority chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#64748B] font-medium text-[11px] uppercase tracking-wider">Priority:</span>
            {[
              { id: '', label: 'All' },
              { id: 'outside_delhi', label: 'Non-Delhi (Priority)' },
              { id: 'delhi', label: 'Delhi' },
            ].map((pr) => (
              <button
                key={pr.id}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, schooling: pr.id }));
                  setCurrentCursor(null);
                  setCursorStack([]);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  filters.schooling === pr.id
                    ? 'bg-[#2F5BD6] text-white'
                    : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:bg-[#EEF2FF]'
                }`}
              >
                {pr.label}
              </button>
            ))}
          </div>

          {/* Gender filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#64748B] font-medium text-[11px] uppercase tracking-wider">Gender:</span>
            {[
              { id: '', label: 'All' },
              { id: 'M', label: 'Male' },
              { id: 'F', label: 'Female' },
            ].map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, gender: g.id }));
                  setCurrentCursor(null);
                  setCursorStack([]);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  filters.gender === g.id
                    ? 'bg-[#2F5BD6] text-white'
                    : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:bg-[#EEF2FF]'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Branch dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B] font-medium text-[11px] uppercase tracking-wider">Branch:</span>
            <select
              value={filters.branch}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, branch: e.target.value }));
                setCurrentCursor(null);
                setCursorStack([]);
              }}
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded px-2 py-0.5 text-[11px] font-semibold text-[#0F172A] focus:outline-none"
            >
              <option value="">All Branches</option>
              {['CSE', 'CSDS', 'IT', 'ECE', 'EE', 'ME', 'ICE', 'BT', 'MAC', 'EIOT'].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (Visible when rows are selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-[#1E3A8A] text-white px-4 py-2.5 rounded shadow flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold tabular-nums">{selectedIds.length} application(s) selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setConfirmDialog({
                  open: true,
                  decision: 'VERIFIED',
                  ids: selectedIds,
                })
              }
              className="px-3 py-1 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Bulk Verify ({selectedIds.length})</span>
            </button>
            <button
              onClick={() =>
                setConfirmDialog({
                  open: true,
                  decision: 'REJECTED',
                  ids: selectedIds,
                })
              }
              className="px-3 py-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold rounded transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Bulk Reject ({selectedIds.length})</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 text-slate-300 hover:text-white"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* TanStack Table Container */}
      <div className="bg-white border border-[#E2E8F0] rounded shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-[#CBD5E1] text-[#2F5BD6] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3">Roll Number</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-2 text-center">Gender</th>
                <th className="py-2.5 px-2 text-center">Branch</th>
                <th className="py-2.5 px-3">Schooling Priority</th>
                <th className="py-2.5 px-3">Home Location</th>
                <th className="py-2.5 px-3 text-right">Distance (km)</th>
                <th className="py-2.5 px-2 text-center">Band</th>
                <th className="py-2.5 px-2 text-right">Merit</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[#64748B]">
                    Loading verification queue...
                  </td>
                </tr>
              ) : !data?.items || data.items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[#64748B]">
                    No applications match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                data.items.map((app) => {
                  const isSelected = selectedIds.includes(app.application_id);
                  return (
                    <tr
                      key={app.application_id}
                      className={`hover:bg-[#F8FAFC] transition-colors ${
                        isSelected ? 'bg-[#EEF2FF]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(app.application_id)}
                          className="rounded border-[#CBD5E1] text-[#2F5BD6] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Roll Number */}
                      <td className="py-2.5 px-3 font-mono font-medium text-[#0F172A]">
                        {app.roll_no}
                      </td>

                      {/* Full Name */}
                      <td className="py-2.5 px-3 font-semibold text-[#0F172A]">
                        {app.full_name}
                      </td>

                      {/* Gender */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.2 text-[10px] font-bold rounded ${
                            app.gender === 'M'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {app.gender}
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="py-2.5 px-2 text-center font-mono font-semibold text-[#475569]">
                        {app.branch}
                      </td>

                      {/* Schooling Priority */}
                      <td className="py-2.5 px-3">
                        {app.is_delhi_candidate ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">
                            Delhi
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EEF2FF] text-[#2F5BD6] border border-[#CBD5E1]">
                            Non-Delhi ({app.schooling_state})
                          </span>
                        )}
                      </td>

                      {/* Home Location */}
                      <td className="py-2.5 px-3 text-[#475569]">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#64748B]" />
                          <span>
                            {app.home_city}, {app.home_state}
                          </span>
                        </div>
                      </td>

                      {/* Distance km */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-[#0F172A]">
                        {Number(app.distance_km).toFixed(2)}
                      </td>

                      {/* Band */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.2 text-[10px] font-bold rounded ${
                            app.distance_band === 4
                              ? 'bg-purple-100 text-purple-800'
                              : app.distance_band === 3
                              ? 'bg-blue-100 text-blue-800'
                              : app.distance_band === 2
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          B{app.distance_band}
                        </span>
                      </td>

                      {/* Merit Rank */}
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#475569]">
                        #{app.merit_rank}
                      </td>

                      {/* Verification Status */}
                      <td className="py-2.5 px-3 text-center">
                        {app.verification_status === 'VERIFIED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified
                          </span>
                        ) : app.verification_status === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Inline Actions */}
                      <td className="py-2.5 px-3 text-right space-x-1">
                        <button
                          onClick={() => handleVerifyDecision('VERIFIED', [app.application_id])}
                          className="px-2 py-1 text-[11px] font-semibold bg-[#ECFDF5] hover:bg-[#059669] text-[#059669] hover:text-white border border-[#A7F3D0] rounded transition-colors"
                          title="Verify candidate distance & documents"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => handleVerifyDecision('REJECTED', [app.application_id])}
                          className="px-2 py-1 text-[11px] font-semibold bg-[#FEF2F2] hover:bg-[#DC2626] text-[#DC2626] hover:text-white border border-[#FECACA] rounded transition-colors"
                          title="Reject candidate"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Keyset Pagination Toolbar */}
        <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-4 py-3 flex items-center justify-between text-xs text-[#475569]">
          <div className="flex items-center gap-2">
            <span>
              Showing{' '}
              <strong className="font-semibold text-[#0F172A] tabular-nums">
                {data?.items ? data.items.length : 0}
              </strong>{' '}
              of{' '}
              <strong className="font-semibold text-[#0F172A] tabular-nums">
                {data?.total ?? 0}
              </strong>{' '}
              total applications (Keyset Window: 50 rows)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (cursorStack.length > 0) {
                  const newStack = [...cursorStack];
                  newStack.pop();
                  const prevCursor = newStack[newStack.length - 1] || null;
                  setCursorStack(newStack);
                  setCurrentCursor(prevCursor);
                }
              }}
              disabled={cursorStack.length === 0 || loading}
              className="px-2.5 py-1.5 border border-[#CBD5E1] rounded bg-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC] flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => {
                if (data?.nextCursor) {
                  setCursorStack((prev) => [...prev, data.nextCursor!]);
                  setCurrentCursor(data.nextCursor);
                }
              }}
              disabled={!data?.hasMore || loading}
              className="px-2.5 py-1.5 border border-[#CBD5E1] rounded bg-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC] flex items-center gap-1 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Bulk Verification */}
      {confirmDialog?.open && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#E2E8F0] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  confirmDialog.decision === 'VERIFIED'
                    ? 'bg-[#ECFDF5] text-[#059669]'
                    : 'bg-[#FEF2F2] text-[#DC2626]'
                }`}
              >
                <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-base font-bold font-heading text-[#0F172A]">
                  Confirm Bulk {confirmDialog.decision}
                </h3>
                <p className="text-xs text-[#64748B]">Audited Institutional Action</p>
              </div>
            </div>

            <p className="text-sm text-[#475569]">
              You are about to mark{' '}
              <strong className="font-semibold text-[#0F172A] tabular-nums">
                {confirmDialog.ids.length}
              </strong>{' '}
              application(s) as{' '}
              <strong
                className={
                  confirmDialog.decision === 'VERIFIED' ? 'text-[#059669]' : 'text-[#DC2626]'
                }
              >
                {confirmDialog.decision}
              </strong>
              . This operation executes in an atomic database transaction and will be permanently recorded in the institutional audit log.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] rounded border border-[#CBD5E1]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVerifyDecision(confirmDialog.decision, confirmDialog.ids)}
                disabled={actionLoading}
                className={`px-4 py-1.5 text-xs font-semibold text-white rounded transition-colors ${
                  confirmDialog.decision === 'VERIFIED'
                    ? 'bg-[#059669] hover:bg-[#047857]'
                    : 'bg-[#DC2626] hover:bg-[#B91C1C]'
                }`}
              >
                {actionLoading ? 'Processing...' : `Confirm (${confirmDialog.ids.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
