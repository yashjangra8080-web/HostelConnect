import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Building,
  Calendar,
  Search,
  Download,
  CheckCircle2,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { StatusTag } from '../ui/StatusTag.js';
import { KPIStrip } from '../ui/KPIStrip.js';
import { ConfirmDialog } from '../ui/ConfirmDialog.js';
import { useToast } from '../ui/Toast.js';

interface RefundRecord {
  refund_id: number | null;
  student_id: number;
  roll_no: string;
  full_name: string;
  room_no: string;
  hostel_name: string;
  meals_scheduled: number;
  meals_eaten: number;
  free_skips: number;
  eligible_missed: number;
  refund_amount: number;
  status: 'PREVIEW' | 'FINAL' | 'NOT_CALCULATED';
}

interface RefundConsoleResponse {
  hostel_id: number;
  month: number;
  year: number;
  total: number;
  page: number;
  pageSize: number;
  summary: {
    total_residents: number;
    total_calculated: number;
    total_refund_amount: number;
    final_count: number;
    preview_count: number;
    status: 'PREVIEW' | 'FINAL' | 'NOT_CALCULATED';
  };
  refunds: RefundRecord[];
}

export const ManagerRefundConsole: React.FC = () => {
  const { toast } = useToast();
  const [selectedHostel, setSelectedHostel] = useState<number>(1);
  const [month, setMonth] = useState<number>(10);
  const year = 2026;
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<RefundConsoleResponse | null>(null);

  // Search & Filtering
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Action Loading States
  const [calculatingPreview, setCalculatingPreview] = useState<boolean>(false);
  const [finalising, setFinalising] = useState<boolean>(false);

  // Confirm Finalise Dialog State
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        hostel_id: String(selectedHostel),
        month: String(month),
        year: String(year),
        page: String(page),
        pageSize: String(pageSize),
        search: searchTerm,
      });

      const res = await fetch(`/api/mess/refunds?${query.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to load refund ledger.');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || 'Error fetching refund records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, [selectedHostel, month, year, page, pageSize]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRefunds();
  };

  // Run Preview Calculation
  const handleRunPreview = async () => {
    setCalculatingPreview(true);
    try {
      const res = await fetch('/api/mess/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          hostel_id: selectedHostel,
          month,
          year,
          mode: 'PREVIEW',
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to calculate preview');

      toast.success(
        `Calculated preview for ${json.residentsCalculated} residents in ${json.executionTimeMs}ms!`
      );
      fetchRefunds();
    } catch (err: any) {
      toast.error(err.message || 'Error generating preview refunds');
    } finally {
      setCalculatingPreview(false);
    }
  };

  // Finalise execution
  const handleFinaliseConfirm = async () => {
    setFinalising(true);
    try {
      const res = await fetch('/api/mess/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          hostel_id: selectedHostel,
          month,
          year,
          mode: 'FINAL',
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to finalise refunds');

      toast.success(
        `Finalised refunds for ${json.residentsCalculated} residents! Ledger locked permanently.`
      );
      setIsConfirmOpen(false);
      fetchRefunds();
    } catch (err: any) {
      toast.error(err.message || 'Error during finalisation');
    } finally {
      setFinalising(false);
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const query = new URLSearchParams({
        hostel_id: String(selectedHostel),
        month: String(month),
        year: String(year),
        page: '1',
        pageSize: '1000',
        search: searchTerm,
      });

      const res = await fetch(`/api/mess/refunds?${query.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to retrieve full roster for CSV export');
      const json = await res.json();
      const records: RefundRecord[] = json.refunds || [];

      if (records.length === 0) {
        toast.info('No refund records to export.');
        return;
      }

      const headers = [
        'Roll Number',
        'Student Name',
        'Room',
        'Hostel',
        'Scheduled Meals',
        'Meals Eaten',
        'Free Skips',
        'Eligible Missed',
        'Refund Amount (INR)',
        'Status',
      ];

      const csvRows = [
        headers.join(','),
        ...records.map((r) =>
          [
            `"${r.roll_no}"`,
            `"${r.full_name}"`,
            `"${r.room_no}"`,
            `"${r.hostel_name || 'BH1'}"`,
            r.meals_scheduled,
            r.meals_eaten,
            r.free_skips,
            r.eligible_missed,
            r.refund_amount,
            `"${r.status}"`,
          ].join(',')
        ),
      ];

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mess_refunds_hostel_${selectedHostel}_${month}_${year}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${records.length} resident records to CSV.`);
    } catch (err: any) {
      toast.error(err.message || 'Error exporting CSV');
    }
  };

  const totalResidents = data?.summary?.total_residents || data?.total || 0;
  const totalOutlay = Number(data?.summary?.total_refund_amount || 0);
  const ledgerStatus = data?.summary?.status || 'NOT_CALCULATED';
  const isFinalised = ledgerStatus === 'FINAL';
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / pageSize));

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-saffron mb-1">
            <Receipt className="w-4 h-4" strokeWidth={1.75} />
            <span>HostelConnect • Mess Manager Console</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-ink-primary">
            Monthly Dining Rebate & Refund Ledger
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            Compute, audit, preview, and lock attendance-based meal refunds across ~300 active residents in IST.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Hostel Select */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded px-3 py-1.5 text-xs">
            <Building className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
            <select
              value={selectedHostel}
              onChange={(e) => {
                setSelectedHostel(Number(e.target.value));
                setPage(1);
              }}
              className="bg-transparent font-medium text-ink-primary focus:outline-none cursor-pointer"
            >
              <option value={1}>BH1 (Boys Hostel 1)</option>
              <option value={2}>BH2 (Boys Hostel 2)</option>
              <option value={3}>GH1 (Girls Hostel 1)</option>
            </select>
          </div>

          {/* Month/Year Select */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
            <select
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                setPage(1);
              }}
              className="bg-transparent font-medium text-ink-primary focus:outline-none cursor-pointer"
            >
              <option value={9}>Sep 2026</option>
              <option value={10}>Oct 2026</option>
              <option value={11}>Nov 2026</option>
              <option value={12}>Dec 2026</option>
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={fetchRefunds} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            Sync
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
            CSV Export
          </Button>

          {/* Recalculate Preview */}
          {!isFinalised && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunPreview}
              disabled={calculatingPreview}
            >
              {calculatingPreview ? 'Calculating...' : 'Run Preview'}
            </Button>
          )}

          {/* Finalise Button */}
          {!isFinalised ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsConfirmOpen(true)}
              disabled={!totalResidents || finalising}
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />
              Finalise Refunds
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded text-xs font-semibold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
              FINAL & IMMUTABLE
            </div>
          )}
        </div>
      </div>

      {/* Institutional KPI Strip */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs text-ink-secondary">
          <span className="font-semibold uppercase tracking-wider">
            Ledger Metrics • Hostel {selectedHostel} ({month}/{year})
          </span>
          <span className="text-ink-muted font-mono tabular-nums">
            Rate: ₹40.00/meal • Free Skips: 15 • Cap: 60%
          </span>
        </div>

        <KPIStrip
          items={[
            {
              id: '1',
              label: 'Total Residents',
              value: String(totalResidents),
              subtext: 'Roster mapped via v_current_residence',
              badge: <StatusTag status="primary" label="ROSTER" size="sm" />,
            },
            {
              id: '2',
              label: 'Calculated Outlay',
              value: `₹${totalOutlay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
              subtext: `Avg ₹${(totalOutlay / (totalResidents || 1)).toFixed(2)} / resident`,
              badge: <StatusTag status="success" label="LEDGER OUTLAY" size="sm" />,
            },
            {
              id: '3',
              label: 'Finalised Count',
              value: String(data?.summary?.final_count || 0),
              subtext: 'Locked immutable records',
              badge: <StatusTag status={data?.summary?.final_count ? 'success' : 'neutral'} label="FINAL" size="sm" />,
            },
            {
              id: '4',
              label: 'Ledger State',
              value: ledgerStatus,
              subtext: isFinalised ? 'Locked permanently' : 'Re-runnable calculation',
              badge: (
                <StatusTag
                  status={isFinalised ? 'success' : 'warning'}
                  label={isFinalised ? 'IMMUTABLE' : 'PREVIEW'}
                  size="sm"
                />
              ),
            },
          ]}
        />
      </section>

      {/* Search and Table Controls */}
      <div className="p-4 bg-surface border border-border rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-80">
          <Input
            placeholder="Search roll number, name, room..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs"
          />
          <Button type="submit" variant="outline" size="sm" className="shrink-0">
            <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-ink-secondary w-full sm:w-auto justify-end">
          <span className="tabular-nums">
            Showing <strong className="text-ink-primary font-mono">{data?.refunds?.length || 0}</strong> of{' '}
            <strong className="text-ink-primary font-mono">{data?.total || 0}</strong> residents
          </span>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="bg-surface border border-border rounded px-2 py-1 text-xs text-ink-primary focus:outline-none"
          >
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={300}>All 300 / page</option>
          </select>
        </div>
      </div>

      {/* Roster Table Container */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-subtle border-b border-border text-ink-muted uppercase font-semibold text-[11px] select-none">
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Resident Name</th>
                <th className="py-3 px-4">Room</th>
                <th className="py-3 px-4 text-right">Scheduled</th>
                <th className="py-3 px-4 text-right">Eaten</th>
                <th className="py-3 px-4 text-right">Free Skips</th>
                <th className="py-3 px-4 text-right">Eligible Missed</th>
                <th className="py-3 px-4 text-right">Refund (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    Loading resident refund records...
                  </td>
                </tr>
              ) : !data?.refunds?.length ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    No refund records found for this hostel and month. Click &quot;Run Preview&quot; to calculate.
                  </td>
                </tr>
              ) : (
                data.refunds.map((row) => (
                  <tr key={`${row.student_id}-${row.roll_no}`} className="hover:bg-surface-subtle/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-ink-primary tabular-nums">
                      {row.roll_no}
                    </td>
                    <td className="py-3 px-4 font-medium text-ink-primary">
                      {row.full_name}
                    </td>
                    <td className="py-3 px-4 text-ink-secondary font-mono">
                      {row.room_no}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-ink-secondary">
                      {row.meals_scheduled}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-ink-primary">
                      {row.meals_eaten}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-ink-muted">
                      {row.free_skips}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {row.eligible_missed}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-ink-primary">
                      ₹{Number(row.refund_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusTag
                        status={row.status === 'FINAL' ? 'success' : row.status === 'PREVIEW' ? 'primary' : 'neutral'}
                        label={row.status}
                        size="sm"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-surface-subtle border-t border-border flex items-center justify-between text-xs">
            <span className="text-ink-secondary">
              Page <strong className="text-ink-primary font-mono">{page}</strong> of{' '}
              <strong className="text-ink-primary font-mono">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Finalisation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleFinaliseConfirm}
        title="Finalise Mess Refunds (Permanent Lock)"
        isLoading={finalising}
        confirmLabel={finalising ? 'Locking...' : 'Yes, Finalise and Notify Residents'}
        isDestructive={true}
        description={
          <div className="space-y-3">
            <p>
              You are about to permanently finalise mess refunds for{' '}
              <strong className="text-ink-primary">Hostel {selectedHostel}</strong> for{' '}
              <strong className="text-ink-primary">{month}/{year}</strong>.
            </p>

            <div className="p-3 bg-surface-subtle rounded border border-border text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span>Total Residents:</span>
                <strong className="text-ink-primary">{totalResidents} residents</strong>
              </div>
              <div className="flex justify-between">
                <span>Total Outlay:</span>
                <strong className="text-emerald-700">
                  ₹{totalOutlay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <p className="text-[11px] text-amber-700 font-sans">
              <strong>Warning:</strong> Under institutional rules, FINAL records are made strictly immutable via MySQL trigger and cannot be updated or recalculated. An automatic notification will be dispatched to each student.
            </p>
          </div>
        }
      />
    </div>
  );
};
