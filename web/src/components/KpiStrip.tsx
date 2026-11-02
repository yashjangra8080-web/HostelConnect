import React from 'react';
import { ClipboardList, Clock, CheckCircle2, XCircle, Navigation, BedDouble } from 'lucide-react';
import { KPIStats } from '../types';

interface KpiStripProps {
  stats: KPIStats | null;
  loading?: boolean;
}

export const KpiStrip: React.FC<KpiStripProps> = ({ stats, loading = false }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* 1. Total Applications */}
      <div className="bg-white border border-[#E2E8F0] rounded p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
          <span>Total Applications</span>
          <ClipboardList className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
        </div>
        <div className="text-xl font-bold font-heading text-[#0F172A] tabular-nums">
          {loading ? '—' : stats?.totalApplications.toLocaleString('en-IN') ?? '0'}
        </div>
        <div className="text-[11px] text-[#64748B] mt-0.5">Cycle 2026-27 Active</div>
      </div>

      {/* 2. Pending Verification */}
      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-[#D97706] text-xs font-semibold mb-1">
          <span>Pending Verification</span>
          <Clock className="w-4 h-4 text-[#D97706]" strokeWidth={1.75} />
        </div>
        <div className="text-xl font-bold font-heading text-[#D97706] tabular-nums">
          {loading ? '—' : stats?.pendingVerification.toLocaleString('en-IN') ?? '0'}
        </div>
        <div className="text-[11px] text-[#B45309] mt-0.5">Requires office action</div>
      </div>

      {/* 3. Verified Applications */}
      <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-[#059669] text-xs font-semibold mb-1">
          <span>Verified (Eligible)</span>
          <CheckCircle2 className="w-4 h-4 text-[#059669]" strokeWidth={1.75} />
        </div>
        <div className="text-xl font-bold font-heading text-[#059669] tabular-nums">
          {loading ? '—' : stats?.verifiedApplications.toLocaleString('en-IN') ?? '0'}
        </div>
        <div className="text-[11px] text-[#047857] mt-0.5">Eligible for ranking</div>
      </div>

      {/* 4. Rejected Applications */}
      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-[#DC2626] text-xs font-semibold mb-1">
          <span>Rejected Applications</span>
          <XCircle className="w-4 h-4 text-[#DC2626]" strokeWidth={1.75} />
        </div>
        <div className="text-xl font-bold font-heading text-[#DC2626] tabular-nums">
          {loading ? '—' : stats?.rejectedApplications.toLocaleString('en-IN') ?? '0'}
        </div>
        <div className="text-[11px] text-[#B91C1C] mt-0.5">Disqualified / Invalid</div>
      </div>

      {/* 5. Non-Delhi Candidates */}
      <div className="bg-white border border-[#E2E8F0] rounded p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
          <span>Non-Delhi Priority</span>
          <Navigation className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
        </div>
        <div className="text-xl font-bold font-heading text-[#0F172A] tabular-nums">
          {loading ? '—' : stats?.nonDelhiApplications.toLocaleString('en-IN') ?? '0'}
        </div>
        <div className="text-[11px] text-[#64748B] mt-0.5">
          Avg. {stats?.avgDistanceKm ? `${stats.avgDistanceKm} km` : '—'}
        </div>
      </div>

      {/* 6. Bed Capacity & Allotment */}
      <div className="bg-white border border-[#E2E8F0] rounded p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
          <span>Residential Beds</span>
          <BedDouble className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
        </div>
        <div className="text-xl font-bold font-heading text-[#0F172A] tabular-nums">
          {loading ? '—' : `${stats?.allottedResidents ?? 0} / ${stats?.totalCapacity ?? 300}`}
        </div>
        <div className="text-[11px] text-[#64748B] mt-0.5">4 Hostels (BH1, BH2, GH1, GH2)</div>
      </div>
    </div>
  );
};
