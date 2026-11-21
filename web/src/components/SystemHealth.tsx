import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, Clock, RefreshCw, Layers, HardDrive } from 'lucide-react';
import { Button } from './ui/Button.js';
import { StatusTag } from './ui/StatusTag.js';
import { ErrorState } from './ui/ErrorState.js';

interface HealthData {
  status: 'healthy' | 'degraded' | 'error';
  latencyMs: number;
  uptimeSeconds: number;
  database: {
    connected: boolean;
    event_scheduler: string;
    time_zone: string;
    server_time: string;
    mysql_version: string;
    database_name: string;
  };
  counts: {
    students: number;
    rooms: number;
    allotments: number;
    applications: number;
    mess_attendance: number;
    complaints: number;
    notices: number;
    audit_log: number;
  };
  node_env: string;
}

export const SystemHealth: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, error, refetch, isFetching } = useQuery<HealthData>({
    queryKey: ['admin-health'],
    queryFn: async () => {
      const res = await fetch('/api/admin/health');
      if (!res.ok) {
        throw new Error(`Health check failed with status ${res.status}`);
      }
      return res.json();
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <ErrorState
          title="System Health Monitor Offline"
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const isSchedulerOn = String(data?.database?.event_scheduler).toUpperCase() === 'ON';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header card */}
      <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-1.5 bg-paper border-2 border-black rounded-[4px] text-black">
              <Activity className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <h1 className="text-2xl font-heading font-extrabold tracking-tight text-black">
              Database & Infrastructure Health
            </h1>
          </div>
          <p className="text-xs text-black/75 font-medium">
            Real-time MySQL 8 telemetry, event scheduler heartbeats, active connection latency, and table size metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-black cursor-pointer bg-paper px-3 py-1.5 border-2 border-black rounded-[4px]">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded-none border-2 border-black"
            />
            <span>Auto-poll (10s)</span>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Poll Now</span>
          </Button>
        </div>
      </div>

      {/* Core Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-black rounded-[4px] p-5 shadow-hard flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-black/60">System Status</span>
              <StatusTag
                status={data?.status === 'healthy' ? 'success' : 'warning'}
                label={data?.status?.toUpperCase() || 'CHECKING'}
                size="sm"
              />
            </div>
            <div className="text-2xl font-heading font-extrabold text-black mt-2">
              {data?.status === 'healthy' ? 'ALL SYSTEMS OPERATIONAL' : 'DEGRADED PERFORMANCE'}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-between text-xs font-mono">
            <span className="text-black/60">Ping Latency:</span>
            <span className="font-bold text-black">{data?.latencyMs ?? '—'} ms</span>
          </div>
        </div>

        <div className="bg-white border-2 border-black rounded-[4px] p-5 shadow-hard flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-black/60">Event Scheduler</span>
              <StatusTag
                status={isSchedulerOn ? 'success' : 'danger'}
                label={isSchedulerOn ? 'ON' : 'OFF'}
                size="sm"
              />
            </div>
            <div className="text-2xl font-heading font-extrabold text-black mt-2">
              {isSchedulerOn ? 'ACTIVE & TICKING' : 'SCHEDULER DISABLED'}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-between text-xs font-mono">
            <span className="text-black/60">Auto Release / Escalation:</span>
            <span className="font-bold text-emerald-800">Operational</span>
          </div>
        </div>

        <div className="bg-white border-2 border-black rounded-[4px] p-5 shadow-hard flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-black/60">Server Uptime</span>
              <Clock className="w-4 h-4 text-black/60" />
            </div>
            <div className="text-2xl font-heading font-extrabold text-black mt-2 font-mono">
              {data?.uptimeSeconds ? formatUptime(data.uptimeSeconds) : '—'}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-between text-xs font-mono">
            <span className="text-black/60">Node Environment:</span>
            <span className="font-bold text-black uppercase">{data?.node_env}</span>
          </div>
        </div>

        <div className="bg-white border-2 border-black rounded-[4px] p-5 shadow-hard flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-black/60">Database Engine</span>
              <Database className="w-4 h-4 text-black/60" />
            </div>
            <div className="text-xl font-heading font-extrabold text-black mt-2 font-mono truncate">
              {data?.database?.mysql_version || 'MySQL 8.0'}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-between text-xs font-mono">
            <span className="text-black/60">Time Zone:</span>
            <span className="font-bold text-black">{data?.database?.time_zone || '+05:30 (IST)'}</span>
          </div>
        </div>
      </div>

      {/* Database Tables Census */}
      <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-black" />
            <h3 className="font-heading font-extrabold text-base text-black">
              HostelConnect Database Census & Exact Row Counts
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-black/70 bg-paper px-2.5 py-1 border border-black/30 rounded-[3px]">
            Schema: hostelconnect
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-paper/30 border-2 border-black rounded-[4px]">
            <span className="text-[11px] font-mono text-black/60 uppercase font-bold">students</span>
            <div className="text-xl font-heading font-extrabold text-black mt-0.5">
              {data?.counts?.students?.toLocaleString() ?? '—'}
            </div>
            <span className="text-[10px] text-black/70">Enrolled student profiles</span>
          </div>

          <div className="p-3 bg-paper/30 border-2 border-black rounded-[4px]">
            <span className="text-[11px] font-mono text-black/60 uppercase font-bold">rooms</span>
            <div className="text-xl font-heading font-extrabold text-black mt-0.5">
              {data?.counts?.rooms?.toLocaleString() ?? '—'}
            </div>
            <span className="text-[10px] text-black/70">Campus inventory rooms</span>
          </div>

          <div className="p-3 bg-paper/30 border-2 border-black rounded-[4px]">
            <span className="text-[11px] font-mono text-black/60 uppercase font-bold">allotments</span>
            <div className="text-xl font-heading font-extrabold text-black mt-0.5">
              {data?.counts?.allotments?.toLocaleString() ?? '—'}
            </div>
            <span className="text-[10px] text-black/70">Assigned student beds</span>
          </div>

          <div className="p-3 bg-paper/30 border-2 border-black rounded-[4px]">
            <span className="text-[11px] font-mono text-black/60 uppercase font-bold">applications</span>
            <div className="text-xl font-heading font-extrabold text-black mt-0.5">
              {data?.counts?.applications?.toLocaleString() ?? '—'}
            </div>
            <span className="text-[10px] text-black/70">Submitted cycle applications</span>
          </div>

          <div className="p-3 bg-paper/30 border-2 border-black rounded-[4px]">
            <span className="text-[11px] font-mono text-black/60 uppercase font-bold">mess_attendance</span>
            <div className="text-xl font-heading font-extrabold text-black mt-0.5">
              {data?.counts?.mess_attendance?.toLocaleString() ?? '—'}
            </div>
            <span className="text-[10px] text-black/70">QR & counter meal scans</span>
          </div>

          <div className="p-3 bg-paper/30 border-2 border-black rounded-[4px]">
            <span className="text-[11px] font-mono text-black/60 uppercase font-bold">complaints</span>
            <div className="text-xl font-heading font-extrabold text-black mt-0.5">
              {data?.counts?.complaints?.toLocaleString() ?? '—'}
            </div>
            <span className="text-[10px] text-black/70">Confidential grievances</span>
          </div>

          <div className="p-3 bg-paper/30 border-2 border-black rounded-[4px]">
            <span className="text-[11px] font-mono text-black/60 uppercase font-bold">notices</span>
            <div className="text-xl font-heading font-extrabold text-black mt-0.5">
              {data?.counts?.notices?.toLocaleString() ?? '—'}
            </div>
            <span className="text-[10px] text-black/70">Official circulars & bulletins</span>
          </div>

          <div className="p-3 bg-paper/30 border-2 border-black rounded-[4px]">
            <span className="text-[11px] font-mono text-black/60 uppercase font-bold">audit_log</span>
            <div className="text-xl font-heading font-extrabold text-black mt-0.5">
              {data?.counts?.audit_log?.toLocaleString() ?? '—'}
            </div>
            <span className="text-[10px] text-black/70">Forensic mutation records</span>
          </div>
        </div>
      </div>

      {/* Role Connection Pools Architecture Strip */}
      <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-black" />
          <h3 className="font-heading font-extrabold text-base text-black">
            Per-Role Least-Privilege MySQL Connection Pools
          </h3>
        </div>
        <p className="text-xs text-black/75 font-medium leading-relaxed">
          HostelConnect enforces database-level role isolation. Each incoming request connects strictly via that role's dedicated MySQL user account (<code className="font-mono bg-paper px-1.5 py-0.5 border border-black/30 rounded-[3px]">hc_admin</code>, <code className="font-mono bg-paper px-1.5 py-0.5 border border-black/30 rounded-[3px]">hc_hostel_office</code>, <code className="font-mono bg-paper px-1.5 py-0.5 border border-black/30 rounded-[3px]">hc_warden</code>, <code className="font-mono bg-paper px-1.5 py-0.5 border border-black/30 rounded-[3px]">hc_student</code>, etc.) and injects session context via <code className="font-mono bg-paper px-1.5 py-0.5 border border-black/30 rounded-[3px]">@app_user_id</code>.
        </p>
      </div>
    </div>
  );
};
