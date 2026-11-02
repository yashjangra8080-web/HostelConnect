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

// ─── Style helpers ────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  OPEN:        { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  SEEN:        { text: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  IN_PROGRESS: { text: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  RESOLVED:    { text: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  REJECTED:    { text: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

const SEVERITY_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  LOW:    { text: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
  MEDIUM: { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  HIGH:   { text: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  URGENT: { text: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

// Valid next transitions from each state (authority perspective)
const NEXT_STATES: Record<string, string[]> = {
  OPEN:        ['SEEN', 'REJECTED'],
  SEEN:        ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED:    [],
  REJECTED:    [],
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.OPEN;
  return (
    <span style={{
      color: s.text, background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 9999, fontSize: 11, fontWeight: 600, padding: '2px 8px',
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.MEDIUM;
  return (
    <span style={{
      color: s.text, background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 9999, fontSize: 11, fontWeight: 600, padding: '2px 8px',
      display: 'inline-block',
    }}>
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
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40,
        }}
      />
      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 560,
        background: '#FFFFFF', zIndex: 50, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'flex-start', gap: 12,
          background: '#F8FAFC',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <StatusBadge status={complaint.status} />
              <SeverityBadge severity={complaint.severity} />
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#64748B',
                background: '#F3F4F6', border: '1px solid #E5E7EB',
                borderRadius: 9999, padding: '2px 8px',
              }}>
                {complaint.category}
              </span>
              {complaint.is_anonymous && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#7C3AED',
                  background: '#F5F3FF', border: '1px solid #DDD6FE',
                  borderRadius: 9999, padding: '2px 8px',
                }}>
                  ANONYMOUS
                </span>
              )}
              {complaint.escalated_at && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#D97706',
                  background: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: 9999, padding: '2px 8px',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <AlertCircle size={11} strokeWidth={1.75} />
                  ESCALATED
                </span>
              )}
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A', marginBottom: 2 }}>
              {complaint.subject}
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              From: {complaint.student_name}{' '}
              {complaint.student_roll_no !== 'ANONYMOUS' && (
                <code style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                  ({complaint.student_roll_no})
                </code>
              )}
              {' · '}
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatIST(complaint.created_at)}</span>
              {' · '}
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{complaint.age_days}d old</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: 4, color: '#64748B',
            }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Original description */}
          <div style={{
            padding: '12px 14px', background: '#F8FAFC',
            border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Original Complaint
            </div>
            <div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {complaint.description}
            </div>
          </div>

          {/* Responses */}
          {complaint.responses.map((r) => {
            const isAuthority = r.responder_role !== 'STUDENT';
            return (
              <div key={r.response_id} style={{
                marginBottom: 10, padding: '10px 14px',
                background: isAuthority ? '#EEF2FF' : '#F0FDF4',
                border: `1px solid ${isAuthority ? '#C7D2FE' : '#BBF7D0'}`,
                borderRadius: 8, borderLeft: `3px solid ${isAuthority ? '#2F5BD6' : '#059669'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>
                    {r.responder_name}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>{r.responder_role}</span>
                  {r.new_status && <StatusBadge status={r.new_status} />}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                    {formatIST(r.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {r.message}
                </div>
              </div>
            );
          })}
        </div>

        {/* Respond panel */}
        {nextOptions.length > 0 && (
          <div style={{
            padding: '16px 20px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC',
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={{
                  flex: 1, padding: '8px 10px',
                  border: '1px solid #E2E8F0', borderRadius: 6,
                  fontSize: 14, color: '#0F172A', background: '#FFFFFF',
                }}
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
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1px solid #E2E8F0', borderRadius: 6, padding: '8px 12px',
                fontSize: 14, color: '#0F172A', resize: 'vertical',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            />
            {mutation.error && (
              <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>
                {(mutation.error as Error).message}
              </div>
            )}
            <button
              onClick={() => mutation.mutate()}
              disabled={!message.trim() || mutation.isPending}
              style={{
                marginTop: 10, padding: '9px 20px',
                background: '#2F5BD6', color: '#FFFFFF',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontWeight: 500, fontSize: 14, width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: mutation.isPending ? 0.7 : 1,
              }}
            >
              <Send size={14} strokeWidth={1.75} />
              {mutation.isPending ? 'Sending…' : 'Send Response'}
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
        <code style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>
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
        <span style={{ fontSize: 13, color: '#475569' }}>{info.getValue()}</span>
      ),
      size: 110,
    }),
    columnHelper.accessor('subject', {
      header: 'SUBJECT',
      cell: (info) => (
        <div style={{
          fontSize: 13, color: '#0F172A', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200,
        }}>
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('student_name', {
      header: 'STUDENT',
      cell: (info) => (
        <span style={{ fontSize: 13, color: info.getValue() === 'Anonymous Resident' ? '#94A3B8' : '#475569', fontStyle: info.getValue() === 'Anonymous Resident' ? 'italic' : 'normal' }}>
          {info.getValue()}
        </span>
      ),
      size: 140,
    }),
    columnHelper.accessor('age_days', {
      header: 'AGE',
      cell: (info) => (
        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: info.getValue() > 3 ? '#DC2626' : '#475569' }}>
          {info.getValue()}d
        </span>
      ),
      size: 60,
    }),
    columnHelper.display({
      id: 'escalated',
      header: 'FLAG',
      cell: ({ row }) => row.original.escalated_at ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#D97706', fontSize: 12, fontWeight: 600 }}>
          <AlertCircle size={13} strokeWidth={1.75} />
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

  const selectStyle = {
    padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 6,
    fontSize: 13, color: '#0F172A', background: '#FFFFFF', cursor: 'pointer',
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
        Complaint Inbox
      </h1>
      <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 20px' }}>
        Complaints addressed to you or escalated to you for review.
      </p>

      {/* Filter toolbar */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16,
        padding: '12px 16px', background: '#F8FAFC',
        border: '1px solid #E2E8F0', borderRadius: 8,
        flexWrap: 'wrap',
      }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          {['OPEN','SEEN','IN_PROGRESS','RESOLVED','REJECTED'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={selectStyle}>
          <option value="">All Severities</option>
          {['LOW','MEDIUM','HIGH','URGENT'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={selectStyle}>
          <option value="">All Categories</option>
          {['ELECTRICAL','PLUMBING','MESS','CLEANLINESS','CONDUCT','OTHER'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {(statusFilter || severityFilter || categoryFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setSeverityFilter(''); setCategoryFilter(''); }}
            style={{ ...selectStyle, color: '#DC2626', border: '1px solid #FECACA', background: '#FEF2F2' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0',
        borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {isError ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#DC2626' }}>
            Failed to load complaints.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} style={{ background: '#F8FAFC', height: 40 }}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        padding: '0 12px', textAlign: 'left',
                        fontSize: 12, fontWeight: 600, color: '#475569',
                        letterSpacing: '0.06em', whiteSpace: 'nowrap',
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        borderBottom: '1px solid #E2E8F0',
                        width: header.column.columnDef.size,
                        userSelect: 'none',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ChevronUp size={12} strokeWidth={1.75} />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ChevronDown size={12} strokeWidth={1.75} />
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
                    Loading complaints…
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
                    No complaints match the selected filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedComplaint(row.original)}
                    style={{
                      height: 44, cursor: 'pointer',
                      borderBottom: '1px solid #E2E8F0',
                      background: selectedComplaint?.complaint_id === row.original.complaint_id
                        ? 'rgba(47,91,214,0.06)' : '#FFFFFF',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedComplaint?.complaint_id !== row.original.complaint_id)
                        (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(47,91,214,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedComplaint?.complaint_id !== row.original.complaint_id)
                        (e.currentTarget as HTMLTableRowElement).style.background = '#FFFFFF';
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} style={{ padding: '0 12px' }}>
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
          <div style={{
            padding: '10px 16px', borderTop: '1px solid #E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#F8FAFC',
          }}>
            <span style={{ fontSize: 13, color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
              {data?.complaints?.length ?? 0} total complaints
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#475569', opacity: !table.getCanPreviousPage() ? 0.3 : 1 }}>
                <ChevronsLeft size={15} strokeWidth={1.75} />
              </button>
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#475569', opacity: !table.getCanPreviousPage() ? 0.3 : 1 }}>
                <ChevronLeft size={15} strokeWidth={1.75} />
              </button>
              <span style={{ fontSize: 13, color: '#475569', fontVariantNumeric: 'tabular-nums', padding: '0 8px' }}>
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#475569', opacity: !table.getCanNextPage() ? 0.3 : 1 }}>
                <ChevronRight size={15} strokeWidth={1.75} />
              </button>
              <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#475569', opacity: !table.getCanNextPage() ? 0.3 : 1 }}>
                <ChevronsRight size={15} strokeWidth={1.75} />
              </button>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                style={{ marginLeft: 8, padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }}
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
