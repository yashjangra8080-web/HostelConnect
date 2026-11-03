import React from 'react';
import { ClipboardList, Clock, CheckCircle2, XCircle, Navigation, BedDouble } from 'lucide-react';
import { KPIStats } from '../types.js';

interface KpiStripProps {
  stats: KPIStats | null;
  loading?: boolean;
}

export const KpiStrip: React.FC<KpiStripProps> = ({ stats, loading = false }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* 1. Total Applications */}
      <div className="bg-surface border-2 border-black rounded-sm p-3.5 shadow-hard">
        <div className="flex items-center justify-between text-ink-secondary text-xs font-bold mb-1">
          <span>Total Applications</span>
          <ClipboardList className="w-4 h-4 text-ink-primary" strokeWidth={2} />
        </div>
        <div className="text-xl font-extrabold font-heading text-ink-primary tabular-nums">
          {loading ? '—' : stats?.totalApplications.toLocaleString('en-IN') ?? '0'}
        </div>
        <div className="text-[11px] font-medium text-ink-secondary mt-0.5">Cycle 2026-27 Active</div>
      </div>

      {/* 2. Pending Verification */}
      <div className="bg-status-warning-bg border-2 border-black rounded-sm p-3.5 shadow-hard">
        <div className="flex items-center justify-between text-status-warning-text text-xs font-extrabold mb-1">
          <span>Pending Verification</span>
          <Clock className="w-4 h-4 text-status-warning-text" strokeWidth={2} />
        </div>
        <div className="text-xl font-extrabold font-heading text-status-warning-text tabular-nums">
          {loading ? '—' : stats?.pendingVerification.toLocaleString('en-IN') ?? '0'}
        </div>
        <div className="text-[11px] font-bold text-status-warning-text mt-0.5">Requires office action</div>
      </div>

      {/* 3. Verified Applications */}
      <div className="bg-status-success-bg border-2 border-black rounded-sm p-3.5 shadow-hard">
        <div className="flex items-center justify-between text-status-success-text text-xs font-extrabold mb-1">
          <span>Verified (Eligible)</span>
          <CheckCircle2 className="w-4 h-4 text-status-success-text" strokeWidth={2} />
        </div>
        <div className="text-xl font-extrabold font-heading text-status-success-text tabular-nums">
          {loading ? '—' : stats?.verifiedApplications.toLocaleString('en-IN') ?? '0'}
        </div>
        <div className="text-[11px] font-bold text-status-success-text mt-0.5">Eligible for ranking</div>
      </div>

      {/* 4. Rejected Applications */}
      <div className="bg-status-danger-bg border-2 border-black rounded-sm p-3.5 shadow-hard">
        <div className="flex items-center justify-between text-status-danger-text text-xs font-extrabold mb-1">
          <span>Rejected Applications</span>
          <XCircle className="w-4 h-4 text-status-danger-text" strokeWidth={2} />
        </div>
        <div className="text-xl font-extrabold font-heading text-status-danger-text tabular-nums">
          {loading ? '—' : stats?.rejectedApplications.toLocaleString('en-IN') ?? '0'}
        </div>
        <div className="text-[11px] font-bold text-status-danger-text mt-0.5">Disqualified / Invalid</div>
      </div>

      {/* 5. Non-Delhi Candidates */}
      <div className="bg-surface border-2 border-black rounded-sm p-3.5 shadow-hard">
        <div className="flex items-center justify-between text-ink-secondary text-xs font-bold mb-1">
          <span>Non-Delhi Priority</span>
          <Navigation className="w-4 h-4 text-ink-primary" strokeWidth={2} />
        </div>
        <div className="text-xl font-extrabold font-heading text-ink-primary tabular-nums">
          {loading ? '—' : stats?.nonDelhiApplications.toLocaleString('en-IN') ?? '0'}
        </div>
        <div className="text-[11px] font-medium text-ink-secondary mt-0.5">
          Avg. {stats?.avgDistanceKm ? `${stats.avgDistanceKm} km` : '—'}
        </div>
      </div>

      {/* 6. Bed Capacity & Allotment */}
      <div className="bg-surface border-2 border-black rounded-sm p-3.5 shadow-hard">
        <div className="flex items-center justify-between text-ink-secondary text-xs font-bold mb-1">
          <span>Residential Beds</span>
          <BedDouble className="w-4 h-4 text-ink-primary" strokeWidth={2} />
        </div>
        <div className="text-xl font-extrabold font-heading text-ink-primary tabular-nums">
          {loading ? '—' : `${stats?.allottedResidents ?? 0} / ${stats?.totalCapacity ?? 300}`}
        </div>
        <div className="text-[11px] font-medium text-ink-secondary mt-0.5">4 Hostels (BH1, BH2, GH1, GH2)</div>
      </div>
    </div>
  );
};
