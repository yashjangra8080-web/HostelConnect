import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import {
  AlertCircle, X, Send, ChevronUp, ChevronDown,
  ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ComplaintResponse {
  response_id: number;
  responder_role: string;
  responder_name: string;
  message: string;
  new_status: string | null;
  created_at: string;
}

interface Complaint {
  complaint_id: number;
  tracking_code: string;
  student_id: number | null;
  student_roll_no: string;
  student_name: string;
  category: string;
  severity: string;
  subject: string;
  description: string;
  is_anonymous: boolean;
  status: string;
  escalated_at: string | null;
  escalated_to_authority_name: string | null;
  age_days: number;
  created_at: string;
  responses: ComplaintResponse[];
}

// Valid next transitions from each state (authority perspective)
const NEXT_STATES: Record<string, string[]> = {
  OPEN:        ['SEEN', 'REJECTED'],
  SEEN:        ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED:    [],
  REJECTED:    [],
};

function StatusBadge({ status }: { status: string }) {
  const getStyle = () => {
    switch (status) {
      case 'OPEN':
        return 'bg-paper text-black';
      case 'SEEN':
        return 'bg-surface-subtle text-black';
      case 'IN_PROGRESS':
        return 'bg-saffron text-black';
      case 'RESOLVED':
        return 'bg-status-success-bg text-black';
      case 'REJECTED':
        return 'bg-status-danger-bg text-black';
      default:
        return 'bg-paper text-black';
    }
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold border-2 border-black whitespace-nowrap ${getStyle()}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const getStyle = () => {
    switch (severity) {
      case 'LOW':
        return 'bg-white text-black';
      case 'MEDIUM':
        return 'bg-paper text-black';
      case 'HIGH':
        return 'bg-saffron text-black';
      case 'URGENT':
        return 'bg-status-danger-bg text-black';
      default:
        return 'bg-paper text-black';
    }
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold border-2 border-black ${getStyle()}`}
    >
      {severity}
    </span>
  );
}

function formatIST(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Thread Drawer ────────────────────────────────────────────────────────────
function ComplaintDrawer({
  complaint,
  csrfToken,
  onClose,
}: {
  complaint: Complaint;
  csrfToken: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const queryClient = useQueryClient();

  const nextOptions = NEXT_STATES[complaint.status] ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/complaints/${complaint.complaint_id}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ message, new_status: newStatus || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Failed to respond');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints-inbox'] });
      setMessage('');
      setNewStatus('');
      onClose();
    },
  });

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-40"
      />
      {/* Drawer panel */}
      <div className="fixed top-0 right-0 bottom-0 max-w-lg w-full bg-white z-50 flex flex-col shadow-hard-xl border-l-2 border-black animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b-2 border-black flex items-start justify-between gap-3 bg-surface-subtle">
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 flex-wrap mb-2">
              <StatusBadge status={complaint.status} />
              <SeverityBadge severity={complaint.severity} />
              <span className="text-[10px] font-heading font-bold text-black bg-white border-2 border-black rounded-[4px] px-1.5 py-0.5">
                {complaint.category}
              </span>
              {complaint.is_anonymous && (
                <span className="text-[10px] font-heading font-bold text-black bg-saffron border-2 border-black rounded-[4px] px-1.5 py-0.5">
                  ANONYMOUS
                </span>
              )}
              {complaint.escalated_at && (
                <span className="text-[10px] font-heading font-bold text-black bg-status-danger-bg border-2 border-black rounded-[4px] px-1.5 py-0.5 flex items-center gap-1">
                  <AlertCircle size={12} strokeWidth={2} />
                  ESCALATED
                </span>
              )}
            </div>
            <div className="font-heading font-extrabold text-base text-black mb-1">
              {complaint.subject}
            </div>
            <div className="text-xs text-black/80 font-sans">
              From: {complaint.student_name}{' '}
              {complaint.student_roll_no !== 'ANONYMOUS' && (
                <code className="text-xs font-mono font-bold text-black">
                  ({complaint.student_roll_no})
                </code>
              )}
              {' · '}
              <span className="tabular-nums font-mono">{formatIST(complaint.created_at)}</span>
              {' · '}
              <span className="tabular-nums font-mono font-bold">{complaint.age_days}d old</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[8px] border-2 border-black bg-white hover:bg-status-danger-bg text-black flex items-center justify-center transition-colors shadow-hard-sm"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Original description */}
          <div className="p-3.5 bg-surface-subtle/20 border-2 border-black rounded-[4px]">
            <div className="text-xs font-heading font-extrabold text-black uppercase tracking-wider mb-1.5">
              Original Complaint
            </div>
            <div className="text-sm text-black font-sans leading-relaxed whitespace-pre-wrap">
              {complaint.description}
            </div>
          </div>

          {/* Responses */}
          {complaint.responses.map((r) => {
            const isAuthority = r.responder_role !== 'STUDENT';
            return (
              <div
                key={r.response_id}
                className={`p-3 rounded-[4px] border-2 border-black shadow-hard-sm ${
                  isAuthority ? 'bg-white' : 'bg-status-success-bg'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-heading font-bold text-sm text-black">
                    {r.responder_name}
                  </span>
                  <span className="text-[10px] font-heading font-bold text-black bg-white border border-black rounded-[4px] px-1 py-0.2">
                    {r.responder_role}
                  </span>
                  {r.new_status && <StatusBadge status={r.new_status} />}
                  <span className="ml-auto text-[11px] text-black/70 font-mono tabular-nums">
                    {formatIST(r.created_at)}
                  </span>
                </div>
                <div className="text-xs text-black font-sans leading-relaxed whitespace-pre-wrap">
                  {r.message}
                </div>
              </div>
            );
          })}
        </div>

        {/* Respond panel */}
        {nextOptions.length > 0 && (
          <div className="p-4 border-t-2 border-black bg-white">
            <div className="flex gap-2 mb-2">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full p-2 border-2 border-black rounded-[8px] text-xs font-heading font-bold text-black bg-white focus:outline-none focus:shadow-hard"
              >
                <option value="">— Keep current status —</option>
                {nextOptions.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Write your response…"
              className="w-full border-2 border-black rounded-[8px] p-2 text-xs text-black font-sans focus:outline-none focus:shadow-hard"
            />
            {mutation.error && (
              <div className="text-xs text-status-danger-text font-medium font-sans mt-1">
                {(mutation.error as Error).message}
              </div>
            )}
            <button
              onClick={() => mutation.mutate()}
              disabled={!message.trim() || mutation.isPending}
              className="mt-2.5 w-full py-2 bg-black text-white text-xs font-heading font-bold rounded-[8px] border-2 border-black hover:bg-black/80 flex items-center justify-center gap-2 shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 transition-all"
            >
              <Send size={13} strokeWidth={2} />
              <span>{mutation.isPending ? 'Sending…' : 'Send Response'}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Inbox Table ─────────────────────────────────────────────────────────
const columnHelper = createColumnHelper<Complaint>();

export function ComplaintInbox({ csrfToken }: { csrfToken: string }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter]   = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const queryParams = new URLSearchParams();
  if (statusFilter)   queryParams.set('status',   statusFilter);
  if (severityFilter) queryParams.set('severity', severityFilter);
  if (categoryFilter) queryParams.set('category', categoryFilter);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['complaints-inbox', statusFilter, severityFilter, categoryFilter],
    queryFn: async () => {
      const res = await fetch(`/api/complaints/inbox?${queryParams}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load inbox');
      return res.json() as Promise<{ complaints: Complaint[] }>;
    },
  });

  const columns = useMemo(() => [
    columnHelper.accessor('tracking_code', {
      header: 'CODE',
      cell: (info) => (
        <code className="text-xs font-mono font-bold text-black bg-saffron px-1.5 py-0.5 rounded-[4px] border border-black shadow-hard-sm">
          {info.getValue()}
        </code>
      ),
      size: 120,
    }),
    columnHelper.accessor('status', {
      header: 'STATUS',
      cell: (info) => <StatusBadge status={info.getValue()} />,
      size: 110,
    }),
    columnHelper.accessor('severity', {
      header: 'SEVERITY',
      cell: (info) => <SeverityBadge severity={info.getValue()} />,
      size: 90,
    }),
    columnHelper.accessor('category', {
      header: 'CATEGORY',
      cell: (info) => (
        <span className="text-xs font-bold text-black">{info.getValue()}</span>
      ),
      size: 110,
    }),
    columnHelper.accessor('subject', {
      header: 'SUBJECT',
      cell: (info) => (
        <div className="text-xs font-heading font-bold text-black truncate max-w-[200px]">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('student_name', {
      header: 'STUDENT',
      cell: (info) => (
        <span className={`text-xs text-black font-medium ${info.getValue() === 'Anonymous Resident' ? 'italic text-black/60' : ''}`}>
          {info.getValue()}
        </span>
      ),
      size: 140,
    }),
    columnHelper.accessor('age_days', {
      header: 'AGE',
      cell: (info) => (
        <span className={`text-xs font-mono font-bold tabular-nums ${info.getValue() > 3 ? 'text-status-danger-text' : 'text-black'}`}>
          {info.getValue()}d
        </span>
      ),
      size: 60,
    }),
    columnHelper.display({
      id: 'escalated',
      header: 'FLAG',
      cell: ({ row }) => row.original.escalated_at ? (
        <span className="inline-flex items-center gap-1 text-black font-heading font-extrabold text-[10px] bg-status-danger-bg px-1.5 py-0.5 rounded-[4px] border border-black">
          <AlertCircle size={12} strokeWidth={2} />
          ESC
        </span>
      ) : null,
      size: 60,
    }),
  ], []);

  const table = useReactTable({
    data: data?.complaints ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const selectClasses = "px-3 py-1.5 border-2 border-black rounded-[8px] text-xs font-heading font-bold text-black bg-white focus:outline-none focus:shadow-hard cursor-pointer";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-heading font-extrabold text-black tracking-tight mb-1">
        Complaint Inbox
      </h1>
      <p className="text-xs text-black/70 font-sans mb-5">
        Complaints addressed to you or escalated to you for review.
      </p>

      {/* Filter toolbar */}
      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-white border-2 border-black rounded-[4px] shadow-hard">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClasses}>
          <option value="">All Statuses</option>
          {['OPEN','SEEN','IN_PROGRESS','RESOLVED','REJECTED'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className={selectClasses}>
          <option value="">All Severities</option>
          {['LOW','MEDIUM','HIGH','URGENT'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClasses}>
          <option value="">All Categories</option>
          {['ELECTRICAL','PLUMBING','MESS','CLEANLINESS','CONDUCT','OTHER'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {(statusFilter || severityFilter || categoryFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setSeverityFilter(''); setCategoryFilter(''); }}
            className="px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] border-2 border-black bg-white hover:bg-status-danger-bg text-black shadow-hard-sm transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border-2 border-black rounded-[4px] overflow-hidden shadow-hard-xl">
        {isError ? (
          <div className="p-12 text-center text-status-danger-text font-heading font-bold text-xs">
            Failed to load complaints.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-surface-subtle border-b-2 border-black h-10">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="px-3 text-left text-xs font-heading font-extrabold uppercase tracking-wider text-black select-none border-b-2 border-black"
                      style={{
                        width: header.column.columnDef.size,
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      }}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ChevronUp size={12} strokeWidth={2} />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ChevronDown size={12} strokeWidth={2} />
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-black">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="p-12 text-center text-black/70 font-sans text-xs">
                    Loading complaints…
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-12 text-center text-black/70 font-sans text-xs">
                    No complaints match the selected filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedComplaint(row.original)}
                    className={`h-11 cursor-pointer transition-colors text-black ${
                      selectedComplaint?.complaint_id === row.original.complaint_id
                        ? 'bg-saffron font-bold'
                        : 'hover:bg-paper'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!isLoading && !isError && (
          <div className="p-3 bg-surface-subtle/20 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-black">
            <span className="font-mono font-bold tabular-nums">
              {data?.complaints?.length ?? 0} total complaints
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="p-1 rounded-[8px] border-2 border-black bg-white text-black hover:bg-saffron disabled:opacity-40 disabled:cursor-not-allowed shadow-hard-sm"
              >
                <ChevronsLeft size={15} strokeWidth={2} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1 rounded-[8px] border-2 border-black bg-white text-black hover:bg-saffron disabled:opacity-40 disabled:cursor-not-allowed shadow-hard-sm"
              >
                <ChevronLeft size={15} strokeWidth={2} />
              </button>
              <span className="font-mono font-bold tabular-nums px-2">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1 rounded-[8px] border-2 border-black bg-white text-black hover:bg-saffron disabled:opacity-40 disabled:cursor-not-allowed shadow-hard-sm"
              >
                <ChevronRight size={15} strokeWidth={2} />
              </button>
              <button
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="p-1 rounded-[8px] border-2 border-black bg-white text-black hover:bg-saffron disabled:opacity-40 disabled:cursor-not-allowed shadow-hard-sm"
              >
                <ChevronsRight size={15} strokeWidth={2} />
              </button>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="ml-2 px-2 py-1 border-2 border-black rounded-[8px] text-xs font-heading font-bold bg-white text-black shadow-hard-sm focus:outline-none"
              >
                {[10, 25, 50, 100].map((ps) => <option key={ps} value={ps}>{ps} / page</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Thread Drawer */}
      {selectedComplaint && (
        <ComplaintDrawer
          complaint={selectedComplaint}
          csrfToken={csrfToken}
          onClose={() => setSelectedComplaint(null)}
        />
      )}
    </div>
  );
}
