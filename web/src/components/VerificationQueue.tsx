import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RotateCcw,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { Application, KeysetResponse } from '../types.js';

interface VerificationQueueProps {
  onRefreshKPIs?: () => void;
}

export const VerificationQueue: React.FC<VerificationQueueProps> = ({ onRefreshKPIs }) => {
  // Query parameters state
  const [filters, setFilters] = useState({
    status: 'ALL',
    band: '',
    gender: '',
    schooling: '',
    branch: '',
    search: '',
  });

  const [searchInput, setSearchInput] = useState('');

  // Keyset Pagination state
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  // Queue Data
  const [data, setData] = useState<KeysetResponse<Application> | null>(null);
  const [loading, setLoading] = useState(false);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Audit Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    decision: 'VERIFIED' | 'REJECTED';
    ids: number[];
  } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fetch Queue Data
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '50',
      });

      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.band) params.append('band', filters.band);
      if (filters.gender) params.append('gender', filters.gender);
      if (filters.schooling) params.append('schooling', filters.schooling);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.search.trim()) params.append('search', filters.search.trim());
      if (currentCursor) params.append('cursor', currentCursor);

      const res = await fetch(`/api/allotment/verification-queue?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load verification queue.');
      }
      const json: KeysetResponse<Application> = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ text: err.message || 'Error fetching queue', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filters, currentCursor]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Handle Verify/Reject Action (Atomic API)
  const handleVerifyDecision = async (
    decision: 'VERIFIED' | 'REJECTED',
    applicationIds: number[]
  ) => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/allotment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          application_ids: applicationIds,
          decision,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Verification update failed.');
      }

      setStatusMessage({
        text: `Successfully updated ${result.updated} application(s) to ${decision}.`,
        type: 'success',
      });

      // Clear selections & close dialog
      setSelectedIds((prev) => prev.filter((id) => !applicationIds.includes(id)));
      setConfirmDialog(null);

      // Refresh Queue
      fetchQueue();
      if (onRefreshKPIs) onRefreshKPIs();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Row Selection Helpers
  const toggleSelectRow = (appId: number) => {
    setSelectedIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
  };

  const allCurrentPageSelected =
    data?.items &&
    data.items.length > 0 &&
    data.items.every((item) => selectedIds.includes(item.application_id));

  const toggleSelectAll = () => {
    if (!data?.items) return;
    if (allCurrentPageSelected) {
      const currentIds = data.items.map((i) => i.application_id);
      setSelectedIds((prev) => prev.filter((id) => !currentIds.includes(id)));
    } else {
      const currentIds = data.items.map((i) => i.application_id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  // CSV Export Action
  const handleExportCsv = () => {
    if (!data?.items || data.items.length === 0) return;
    const headers = [
      'Application ID',
      'Roll Number',
      'Student Name',
      'Gender',
      'Branch',
      'Merit Rank',
      'Schooling State',
      'Priority Group',
      'Home City',
      'Home State',
      'Distance KM',
      'Distance Band',
      'Status',
    ];

    const rows = data.items.map((app) => [
      app.application_id,
      app.roll_no,
      `"${app.full_name}"`,
      app.gender,
      app.branch,
      app.merit_rank,
      `"${app.schooling_state}"`,
      app.is_delhi_candidate ? 'Delhi' : 'Non-Delhi',
      `"${app.home_city}"`,
      `"${app.home_state}"`,
      app.distance_km,
      app.distance_band,
      app.verification_status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e: (string | number)[]) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hostel_verification_queue_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          className={`px-4 py-2.5 rounded-[4px] text-xs font-medium border-2 border-black flex items-center justify-between shadow-hard-sm ${
            statusMessage.type === 'success'
              ? 'bg-status-success-bg text-black'
              : 'bg-status-danger-bg text-black'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold ml-2">
            <X className="w-4 h-4 text-black" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* FilterBar & URL Chips */}
      <div className="bg-white border-2 border-black rounded-[4px] p-4 shadow-hard space-y-3">
        {/* Top search & quick actions row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/60"
                strokeWidth={2}
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
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border-2 border-black rounded-[8px] text-black placeholder-black/50 font-sans focus:outline-none focus:shadow-hard"
              />
            </div>
            <button
              onClick={() => {
                setFilters((prev) => ({ ...prev, search: searchInput }));
                setCurrentCursor(null);
                setCursorStack([]);
              }}
              className="px-3 py-1.5 text-xs font-heading font-bold bg-black text-white rounded-[8px] border-2 border-black hover:bg-black/80 transition-all shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px]"
            >
              Search
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 text-xs font-heading font-bold bg-white border-2 border-black text-black rounded-[8px] hover:bg-paper flex items-center gap-1.5 transition-all shadow-hard-sm"
              title="Export current filtered view to CSV"
            >
              <Download className="w-3.5 h-3.5 text-black" strokeWidth={2} />
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
                className="px-2.5 py-1.5 text-xs text-black hover:bg-status-danger-bg rounded-[8px] border-2 border-black font-heading font-bold flex items-center gap-1 transition-colors shadow-hard-sm"
              >
                <RotateCcw className="w-3 h-3 text-black" strokeWidth={2} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* FilterBar Chips Rows */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t-2 border-black text-xs">
          {/* Status chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-black/70 font-heading font-bold text-[11px] uppercase tracking-wider">Status:</span>
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
                className={`px-2.5 py-1 rounded-[8px] text-xs font-heading font-bold border-2 border-black transition-colors ${
                  filters.status === st.id
                    ? 'bg-black text-white shadow-hard-sm'
                    : 'bg-white text-black hover:bg-saffron'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Distance Band chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-black/70 font-heading font-bold text-[11px] uppercase tracking-wider">Band:</span>
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
                className={`px-2 py-0.5 rounded-[8px] text-[11px] font-heading font-bold border-2 border-black transition-colors ${
                  filters.band === bd.id
                    ? 'bg-black text-white shadow-hard-sm'
                    : 'bg-white text-black hover:bg-saffron'
                }`}
              >
                {bd.label}
              </button>
            ))}
          </div>

          {/* Delhi Priority chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-black/70 font-heading font-bold text-[11px] uppercase tracking-wider">Priority:</span>
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
                className={`px-2 py-0.5 rounded-[8px] text-[11px] font-heading font-bold border-2 border-black transition-colors ${
                  filters.schooling === pr.id
                    ? 'bg-black text-white shadow-hard-sm'
                    : 'bg-white text-black hover:bg-saffron'
                }`}
              >
                {pr.label}
              </button>
            ))}
          </div>

          {/* Gender filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-black/70 font-heading font-bold text-[11px] uppercase tracking-wider">Gender:</span>
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
                className={`px-2 py-0.5 rounded-[8px] text-[11px] font-heading font-bold border-2 border-black transition-colors ${
                  filters.gender === g.id
                    ? 'bg-black text-white shadow-hard-sm'
                    : 'bg-white text-black hover:bg-saffron'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Branch dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-black/70 font-heading font-bold text-[11px] uppercase tracking-wider">Branch:</span>
            <select
              value={filters.branch}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, branch: e.target.value }));
                setCurrentCursor(null);
                setCursorStack([]);
              }}
              className="bg-white border-2 border-black rounded-[8px] px-2 py-0.5 text-[11px] font-heading font-bold text-black focus:outline-none shadow-hard-sm"
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
        <div className="bg-saffron text-black border-2 border-black px-4 py-2.5 rounded-[4px] shadow-hard-lg flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-black" strokeWidth={2.5} />
            <span className="font-heading font-extrabold text-sm text-black tabular-nums">{selectedIds.length} application(s) selected</span>
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
              className="px-3 py-1 bg-black hover:bg-black/80 text-white font-heading font-bold rounded-[8px] border-2 border-black transition-all flex items-center gap-1 shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px]"
            >
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
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
              className="px-3 py-1 bg-white hover:bg-status-danger-bg text-black font-heading font-bold rounded-[8px] border-2 border-black transition-all flex items-center gap-1 shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px]"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span>Bulk Reject ({selectedIds.length})</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 text-black font-heading font-bold underline hover:no-underline ml-2"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* TanStack Table Container */}
      <div className="bg-white border-2 border-black rounded-[4px] shadow-hard-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-subtle border-b-2 border-black text-black font-heading font-extrabold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={toggleSelectAll}
                    className="rounded-[4px] border-2 border-black text-black focus:ring-0 cursor-pointer"
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
            <tbody className="divide-y divide-black">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-black/70 font-sans">
                    Loading verification queue...
                  </td>
                </tr>
              ) : !data?.items || data.items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-black/70 font-sans">
                    No applications match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                data.items.map((app) => {
                  const isSelected = selectedIds.includes(app.application_id);
                  return (
                    <tr
                      key={app.application_id}
                      className={`hover:bg-paper transition-colors text-black ${
                        isSelected ? 'bg-saffron font-bold' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(app.application_id)}
                          className="rounded-[4px] border-2 border-black text-black focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Roll Number */}
                      <td className="py-2.5 px-3 font-mono font-bold text-black">
                        {app.roll_no}
                      </td>

                      {/* Full Name */}
                      <td className="py-2.5 px-3 font-heading font-bold text-black">
                        {app.full_name}
                      </td>

                      {/* Gender */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.2 text-[10px] font-heading font-bold rounded-[4px] border-2 border-black ${
                            app.gender === 'M'
                              ? 'bg-surface-subtle text-black'
                              : 'bg-saffron text-black'
                          }`}
                        >
                          {app.gender}
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-black">
                        {app.branch}
                      </td>

                      {/* Schooling Priority */}
                      <td className="py-2.5 px-3">
                        {app.is_delhi_candidate ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold bg-white text-black border-2 border-black">
                            Delhi
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold bg-saffron text-black border-2 border-black">
                            Non-Delhi ({app.schooling_state})
                          </span>
                        )}
                      </td>

                      {/* Home Location */}
                      <td className="py-2.5 px-3 text-black font-medium">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-black" strokeWidth={2} />
                          <span>
                            {app.home_city}, {app.home_state}
                          </span>
                        </div>
                      </td>

                      {/* Distance km */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-black">
                        {Number(app.distance_km).toFixed(2)}
                      </td>

                      {/* Band */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-[4px] border-2 border-black ${
                            app.distance_band === 4
                              ? 'bg-saffron text-black'
                              : app.distance_band === 3
                              ? 'bg-paper text-black'
                              : app.distance_band === 2
                              ? 'bg-surface-subtle text-black'
                              : 'bg-white text-black'
                          }`}
                        >
                          B{app.distance_band}
                        </span>
                      </td>

                      {/* Merit Rank */}
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-black">
                        #{app.merit_rank}
                      </td>

                      {/* Verification Status */}
                      <td className="py-2.5 px-3 text-center">
                        {app.verification_status === 'VERIFIED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold bg-status-success-bg text-black border-2 border-black">
                            <CheckCircle2 className="w-3 h-3 text-black" strokeWidth={2.5} />
                            Verified
                          </span>
                        ) : app.verification_status === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold bg-status-danger-bg text-black border-2 border-black">
                            <XCircle className="w-3 h-3 text-black" strokeWidth={2.5} />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold bg-paper text-black border-2 border-black">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Inline Actions */}
                      <td className="py-2.5 px-3 text-right space-x-1.5">
                        <button
                          onClick={() => handleVerifyDecision('VERIFIED', [app.application_id])}
                          className="px-2 py-1 text-[11px] font-heading font-bold bg-status-success-bg hover:bg-black hover:text-white text-black border-2 border-black rounded-[6px] transition-colors shadow-hard-sm"
                          title="Verify candidate distance & documents"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => handleVerifyDecision('REJECTED', [app.application_id])}
                          className="px-2 py-1 text-[11px] font-heading font-bold bg-status-danger-bg hover:bg-black hover:text-white text-black border-2 border-black rounded-[6px] transition-colors shadow-hard-sm"
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
        <div className="bg-surface-subtle/20 border-t-2 border-black px-4 py-3 flex items-center justify-between text-xs text-black">
          <div className="flex items-center gap-2">
            <span>
              Showing{' '}
              <strong className="font-bold text-black tabular-nums">
                {data?.items ? data.items.length : 0}
              </strong>{' '}
              of{' '}
              <strong className="font-bold text-black tabular-nums">
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
              className="px-2.5 py-1.5 border-2 border-black rounded-[8px] bg-white font-heading font-bold text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-saffron flex items-center gap-1 transition-colors shadow-hard-sm"
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
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
              className="px-2.5 py-1.5 border-2 border-black rounded-[8px] bg-white font-heading font-bold text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-saffron flex items-center gap-1 transition-colors shadow-hard-sm"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Bulk Verification */}
      {confirmDialog?.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[4px] border-2 border-black max-w-md w-full p-6 shadow-hard-xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center shadow-hard-sm ${
                  confirmDialog.decision === 'VERIFIED'
                    ? 'bg-status-success-bg text-black'
                    : 'bg-status-danger-bg text-black'
                }`}
              >
                <AlertTriangle className="w-5 h-5 text-black" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-base font-heading font-extrabold text-black">
                  Confirm Bulk {confirmDialog.decision}
                </h3>
                <p className="text-xs text-black/70 font-sans">Audited Institutional Action</p>
              </div>
            </div>

            <p className="text-xs text-black font-sans leading-relaxed">
              You are about to mark{' '}
              <strong className="font-bold text-black tabular-nums">
                {confirmDialog.ids.length}
              </strong>{' '}
              application(s) as{' '}
              <strong className="font-heading font-bold uppercase underline">
                {confirmDialog.decision}
              </strong>
              . This operation executes in an atomic database transaction and will be permanently recorded in the institutional audit log.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-heading font-bold text-black hover:bg-paper rounded-[8px] border-2 border-black shadow-hard-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVerifyDecision(confirmDialog.decision, confirmDialog.ids)}
                disabled={actionLoading}
                className={`px-4 py-1.5 text-xs font-heading font-bold rounded-[8px] border-2 border-black shadow-hard-sm transition-all active:translate-x-[2px] active:translate-y-[2px] ${
                  confirmDialog.decision === 'VERIFIED'
                    ? 'bg-black text-white hover:bg-black/80'
                    : 'bg-white text-black hover:bg-status-danger-bg'
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
