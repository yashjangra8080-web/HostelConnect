import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Search, RefreshCw, Download, ChevronLeft, ChevronRight, Code, Shield } from 'lucide-react';
import { Button } from './ui/Button.js';
import { ErrorState } from './ui/ErrorState.js';

interface AuditLogEntry {
  log_id: number;
  actor_user_id: number | null;
  actor_login: string | null;
  actor_role: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  table_name: string;
  record_id: number | null;
  details: any;
  logged_at: string;
}

interface AuditResponse {
  logs: AuditLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const AuditTrail: React.FC = () => {
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;
  const [tableName, setTableName] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<AuditResponse>({
    queryKey: ['admin-audit', page, pageSize, tableName, actionFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (tableName) params.append('table_name', tableName);
      if (actionFilter) params.append('action', actionFilter);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load audit trail (${res.status})`);
      }
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 };

  // Export to CSV
  const handleExportCsv = () => {
    if (logs.length === 0) return;

    const headers = ['Log ID', 'Timestamp (IST)', 'Action', 'Table', 'Record ID', 'Actor Login', 'Actor Role', 'Details'];
    const rows = logs.map((log) => [
      log.log_id,
      new Date(log.logged_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      log.action,
      log.table_name,
      log.record_id ?? '',
      log.actor_login ?? 'SYSTEM/ANONYMOUS',
      log.actor_role ?? 'SYSTEM',
      JSON.stringify(log.details || '').replace(/"/g, '""'),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => `"${e.join('","')}"`)].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hostelconnect_audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <ErrorState
          title="Audit Trail Offline"
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header card */}
      <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-1.5 bg-paper border-2 border-black rounded-[4px] text-black">
              <FileSpreadsheet className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <h1 className="text-2xl font-heading font-extrabold tracking-tight text-black">
              Immutable Database Audit Trail
            </h1>
          </div>
          <p className="text-xs text-black/75 font-medium">
            Forensic transaction log recording row-level data modifications across all tables with actor attribution and timestamps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter and controls row */}
      <div className="bg-white border-2 border-black rounded-[4px] p-4 shadow-hard flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-black/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search table, action, JSON details..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-paper/30 border-2 border-black rounded-[4px] text-xs font-medium text-black focus:outline-none focus:bg-white"
            />
          </div>

          <select
            value={tableName}
            onChange={(e) => {
              setTableName(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-paper/30 border-2 border-black rounded-[4px] text-xs font-bold text-black focus:outline-none focus:bg-white"
          >
            <option value="">All Tables</option>
            <option value="allotments">allotments</option>
            <option value="applications">applications</option>
            <option value="students">students</option>
            <option value="rooms">rooms</option>
            <option value="complaints">complaints</option>
            <option value="notices">notices</option>
            <option value="water_quality_reports">water_quality_reports</option>
            <option value="washing_machines">washing_machines</option>
            <option value="mess_config">mess_config</option>
            <option value="users">users</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-paper/30 border-2 border-black rounded-[4px] text-xs font-bold text-black focus:outline-none focus:bg-white"
          >
            <option value="">All Actions</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="RESPOND_ALLOTMENT">RESPOND_ALLOTMENT</option>
            <option value="PUBLISH_CYCLE">PUBLISH_CYCLE</option>
            <option value="PROMOTE_WAITLIST">PROMOTE_WAITLIST</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold text-black">
          <span className="px-2.5 py-1 bg-paper border-2 border-black rounded-[4px]">
            {pagination.total.toLocaleString()} Total Records
          </span>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white border-2 border-black rounded-[4px] shadow-hard overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-paper border-b-2 border-black font-heading font-extrabold text-black">
              <th className="py-2.5 px-3 border-r-2 border-black">Log ID</th>
              <th className="py-2.5 px-3 border-r-2 border-black">Action</th>
              <th className="py-2.5 px-3 border-r-2 border-black">Target Table</th>
              <th className="py-2.5 px-3 border-r-2 border-black">Record ID</th>
              <th className="py-2.5 px-3 border-r-2 border-black">Actor Attribution</th>
              <th className="py-2.5 px-3 border-r-2 border-black">Mutation Payload</th>
              <th className="py-2.5 px-3">Timestamp (IST)</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black/10">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-black/60 font-medium">
                  Loading database audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-black/60 font-medium">
                  No audit logs found matching the specified filters.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.log_id} className="hover:bg-paper/20 transition-colors">
                  <td className="py-2 px-3 border-r-2 border-black/10 font-mono font-bold text-black">
                    #{log.log_id}
                  </td>
                  <td className="py-2 px-3 border-r-2 border-black/10">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-[3px] border text-[10px] font-mono font-bold ${
                        log.action === 'INSERT'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                          : log.action === 'UPDATE'
                          ? 'bg-blue-100 text-blue-900 border-blue-400'
                          : log.action === 'DELETE'
                          ? 'bg-rose-100 text-rose-900 border-rose-400'
                          : 'bg-paper text-black border-black/40'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-r-2 border-black/10 font-mono font-bold text-black">
                    {log.table_name}
                  </td>
                  <td className="py-2 px-3 border-r-2 border-black/10 font-mono text-black/70">
                    {log.record_id ? `#${log.record_id}` : '—'}
                  </td>
                  <td className="py-2 px-3 border-r-2 border-black/10">
                    {log.actor_login ? (
                      <div>
                        <span className="font-mono font-bold text-black">@{log.actor_login}</span>
                        <span className="text-[10px] text-black/60 block font-mono">[{log.actor_role}]</span>
                      </div>
                    ) : (
                      <span className="text-black/50 font-mono italic flex items-center gap-1">
                        <Shield className="w-3 h-3 text-black/40" />
                        Anonymous / System
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 border-r-2 border-black/10 max-w-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-black/80 truncate max-w-[200px]">
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '—')}
                      </span>
                      {log.details && (
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="px-1.5 py-0.5 bg-paper hover:bg-saffron border border-black rounded-[3px] text-[10px] font-mono font-bold shrink-0"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-black/75 whitespace-nowrap">
                    {new Date(log.logged_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="bg-white border-2 border-black rounded-[4px] p-3 shadow-hard flex items-center justify-between">
        <div className="text-xs font-mono font-bold text-black">
          Page {pagination.page} of {Math.max(1, pagination.totalPages)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* JSON Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-[4px] shadow-hard-lg max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-black" />
                <h3 className="font-heading font-extrabold text-lg text-black">
                  Audit Record #{selectedLog.log_id} Payload
                </h3>
              </div>
              <Button variant="subtle" size="sm" onClick={() => setSelectedLog(null)}>
                ✕
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono p-3 bg-paper border border-black/30 rounded-[4px]">
              <div>Action: <strong>{selectedLog.action}</strong></div>
              <div>Table: <strong>{selectedLog.table_name}</strong></div>
              <div>Record ID: <strong>{selectedLog.record_id ?? 'N/A'}</strong></div>
              <div>Actor: <strong>{selectedLog.actor_login ?? 'ANONYMOUS'}</strong></div>
            </div>

            <div>
              <span className="text-xs font-bold text-black mb-1 block">Full JSON Details:</span>
              <pre className="p-4 bg-paper/40 border-2 border-black rounded-[4px] font-mono text-xs overflow-x-auto text-black">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-3 border-t-2 border-black">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
