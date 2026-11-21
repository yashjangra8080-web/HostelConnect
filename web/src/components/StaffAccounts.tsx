import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCheck, Shield, Building, Search, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button.js';
import { StatusTag } from './ui/StatusTag.js';
import { ErrorState } from './ui/ErrorState.js';

interface StaffMember {
  authority_id: number;
  user_id: number;
  hostel_id: number | null;
  designation: string;
  full_name: string;
  login_id: string;
  role: string;
  is_active: number;
  failed_attempts: number;
  created_at: string;
  hostel_name: string | null;
  gender_type: string | null;
}

export const StaffAccounts: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ staff: StaffMember[] }>({
    queryKey: ['admin-staff'],
    queryFn: async () => {
      const res = await fetch('/api/admin/staff');
      if (!res.ok) {
        throw new Error(`Failed to load staff accounts (${res.status})`);
      }
      return res.json();
    },
  });

  const staff = data?.staff || [];

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.login_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.hostel_name && member.hostel_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const designations = Array.from(new Set(staff.map((s) => s.designation)));

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <ErrorState
          title="Staff Directory Offline"
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
              <UserCheck className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <h1 className="text-2xl font-heading font-extrabold tracking-tight text-black">
              Administrative & Operational Staff
            </h1>
          </div>
          <p className="text-xs text-black/75 font-medium">
            Authorized wardens, caretakers, mess managers, and administrative authorities governing NSUT Hostels.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh Roster</span>
          </Button>
        </div>
      </div>

      {/* Filter and stats row */}
      <div className="bg-white border-2 border-black rounded-[4px] p-4 shadow-hard flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-black/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, login, hostel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-paper/30 border-2 border-black rounded-[4px] text-xs font-medium text-black focus:outline-none focus:bg-white"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 bg-paper/30 border-2 border-black rounded-[4px] text-xs font-bold text-black focus:outline-none focus:bg-white"
          >
            <option value="ALL">All Roles ({staff.length})</option>
            {designations.map((d) => (
              <option key={d} value={d}>
                {d.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold text-black">
          <span className="px-2.5 py-1 bg-saffron border-2 border-black rounded-[4px]">
            Active Accounts: {staff.filter((s) => s.is_active === 1).length} / {staff.length}
          </span>
        </div>
      </div>

      {/* Staff grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 bg-white border-2 border-black rounded-[4px] shadow-hard animate-pulse" />
          ))}
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="bg-white border-2 border-black rounded-[4px] p-12 text-center shadow-hard">
          <Shield className="w-10 h-10 text-black/40 mx-auto mb-3" />
          <h3 className="font-heading font-extrabold text-base text-black mb-1">No staff accounts match your filters</h3>
          <p className="text-xs text-black/70 max-w-sm mx-auto mb-4 font-medium">
            Try adjusting your search query or clear the role filter to view all active authorities.
          </p>
          <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setRoleFilter('ALL'); }}>
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((member) => (
            <div
              key={member.authority_id}
              className="bg-white border-2 border-black rounded-[4px] p-5 shadow-hard flex flex-col justify-between hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-black leading-snug">
                      {member.full_name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-black/70 font-mono mt-0.5">
                      <span className="font-bold text-black">@{member.login_id}</span>
                      <span>•</span>
                      <span>Auth #{member.authority_id}</span>
                    </div>
                  </div>
                  <StatusTag
                    status={member.is_active ? 'success' : 'danger'}
                    label={member.is_active ? 'ACTIVE' : 'LOCKED'}
                    size="sm"
                  />
                </div>

                <div className="pt-2 border-t-2 border-black/10 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-black/60 font-medium">Designation:</span>
                    <span className="font-bold text-black bg-paper px-2 py-0.5 rounded-[3px] border border-black/30">
                      {member.designation.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-black/60 font-medium">Assignment:</span>
                    <span className="font-bold text-black flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-black/70" />
                      {member.hostel_name || 'Campus Wide'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-black/60 font-medium">Role Privilege:</span>
                    <span className="font-mono font-bold text-black">{member.role}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t-2 border-black flex items-center justify-between text-[11px] text-black/75 font-mono">
                <span>Created {new Date(member.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                <span className="font-bold text-black">NSUT Dwarka</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
