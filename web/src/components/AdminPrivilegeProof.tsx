import { useState, type ReactNode, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ChevronDown, ChevronRight, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type GrantsResponse = { grants: Record<string, string[]> };

const ROLE_ORDER = [
  'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN',
  'MESS_MANAGER', 'CARETAKER', 'STUDENT',
];

const ROLE_BADGE_CLASSES: Record<string, string> = {
  ADMIN:         'bg-status-danger-subtle text-status-danger-text',
  HOSTEL_OFFICE: 'bg-paper text-black',
  CHIEF_WARDEN:  'bg-surface-subtle text-ink-primary',
  WARDEN:        'bg-surface-subtle text-ink-primary',
  MESS_MANAGER:  'bg-status-success-subtle text-status-success-text',
  CARETAKER:     'bg-status-warning-subtle text-status-warning-text',
  STUDENT:       'bg-surface text-ink-primary',
};

// ─── Grant line analysis ──────────────────────────────────────────────────────
function analyzeGrants(lines: string[]) {
  const hasComplaintSelect = lines.some(
    (l) =>
      l.toUpperCase().includes('SELECT') &&
      (l.toUpperCase().includes('`COMPLAINTS`') ||
        l.toUpperCase().includes('`COMPLAINT_RESPONSES`'))
  );
  const hasExecute = lines.some((l) => l.toUpperCase().includes('EXECUTE'));
  return { hasComplaintSelect, hasExecute };
}

// ─── Grant line coloriser ─────────────────────────────────────────────────────
function colorizeGrantLine(line: string): ReactNode {
  const upper = line.toUpperCase();
  const isRevoke = upper.startsWith('REVOKE');
  const isGrant  = upper.startsWith('GRANT');
  const hasAll   = upper.includes('ALL');
  const hasExec  = upper.includes('EXECUTE');
  const hasSelect = upper.includes('SELECT') &&
    (upper.includes('`COMPLAINTS`') || upper.includes('`COMPLAINT_RESPONSES`'));

  let textClass = 'text-white';
  if (isRevoke || hasSelect) textClass = 'text-status-danger-text font-bold'; // danger — complaint select leak
  else if (hasAll) textClass = 'text-status-success-text';                   // green — full
  else if (isGrant && hasExec) textClass = 'text-saffron font-bold';         // saffron — execute
  else if (isGrant) textClass = 'text-green-300';                            // lime — grant

  return (
    <span className={`block leading-relaxed ${textClass}`}>{line}</span>
  );
}

// ─── Role Panel ───────────────────────────────────────────────────────────────
function RolePanel({ role, lines }: { role: string; lines: string[] }) {
  const [open, setOpen] = useState(role === 'STUDENT'); // open student by default
  const { hasComplaintSelect, hasExecute } = analyzeGrants(lines);
  const badgeClass = ROLE_BADGE_CLASSES[role] ?? ROLE_BADGE_CLASSES.STUDENT;

  return (
    <div className="mb-3 border-2 border-black rounded-sm overflow-hidden shadow-hard bg-surface">
      {/* Header */}
      <div
        onClick={() => setOpen((v) => !v)}
        className={`px-4 py-3 bg-surface hover:bg-surface-subtle/30 flex items-center gap-3 cursor-pointer select-none transition-colors ${
          open ? 'border-b-2 border-black' : ''
        }`}
      >
        <span className={`text-[11px] font-extrabold uppercase tracking-wider border-2 border-black rounded-sm px-2.5 py-0.5 shadow-hard-sm ${badgeClass}`}>
          {role}
        </span>
        <div className="flex-1 flex flex-wrap items-center gap-3">
          {hasComplaintSelect ? (
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-status-danger-text">
              <AlertCircle size={14} strokeWidth={2} />
              SELECT on complaints DETECTED — privilege leak!
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-status-success-text">
              <CheckCircle size={14} strokeWidth={2} />
              No SELECT on complaints/complaint_responses
            </span>
          )}
          {hasExecute && (
            <span className="text-xs font-bold text-ink-primary font-mono">· EXECUTE granted</span>
          )}
          <span className="ml-auto text-xs font-mono font-bold text-ink-secondary tabular-nums">
            {lines.length} grant{lines.length !== 1 ? 's' : ''}
          </span>
        </div>
        {open ? (
          <ChevronDown size={16} strokeWidth={2} className="text-ink-primary" />
        ) : (
          <ChevronRight size={16} strokeWidth={2} className="text-ink-primary" />
        )}
      </div>

      {/* Grant lines */}
      {open && (
        <pre className="m-0 p-4 bg-navy-sidebar text-xs font-mono leading-relaxed overflow-x-auto max-h-96 overflow-y-auto">
          {lines.map((line, i) => (
            <Fragment key={i}>
              {colorizeGrantLine(line)}
            </Fragment>
          ))}
        </pre>
      )}
    </div>
  );
}

// ─── Admin Privilege Proof Page ───────────────────────────────────────────────
export function AdminPrivilegeProof() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['privilege-proof'],
    queryFn: async () => {
      const res = await fetch('/api/admin/privilege-proof', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch SHOW GRANTS');
      return res.json() as Promise<GrantsResponse>;
    },
  });

  const allClean = data
    ? ROLE_ORDER.every((role) => {
        const lines = data.grants[role] ?? [];
        return !analyzeGrants(lines).hasComplaintSelect;
      })
    : false;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Page header */}
      <div className="bg-surface border-2 border-black rounded-sm p-6 shadow-hard-lg">
        <div className="flex items-center gap-3.5 mb-2">
          <div className="w-10 h-10 bg-paper border-2 border-black rounded-sm flex items-center justify-center text-ink-primary shadow-hard-sm">
            <ShieldCheck size={22} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold font-heading text-ink-primary tracking-tight">
              Privilege Proof
            </h1>
            <p className="text-xs font-medium text-ink-secondary">
              Live SHOW GRANTS output per role — verifies complaint table isolation
            </p>
          </div>
        </div>

        {/* Summary banner */}
        {data && (
          <div className={`mt-4 p-3.5 border-2 border-black rounded-sm flex items-center gap-2.5 shadow-hard-sm ${
            allClean ? 'bg-status-success-subtle' : 'bg-status-danger-subtle'
          }`}>
            {allClean ? (
              <CheckCircle size={18} strokeWidth={2.5} className="text-status-success-text shrink-0" />
            ) : (
              <AlertCircle size={18} strokeWidth={2.5} className="text-status-danger-text shrink-0" />
            )}
            <span className={`font-extrabold text-xs ${allClean ? 'text-status-success-text' : 'text-status-danger-text'}`}>
              {allClean
                ? 'All 7 roles confirmed: NO SELECT privilege on complaints or complaint_responses.'
                : 'WARNING: One or more roles has SELECT on complaints / complaint_responses!'}
            </span>
            <button
              onClick={() => refetch()}
              className="ml-auto px-3.5 py-1.5 border-2 border-black rounded-sm bg-surface hover:bg-paper cursor-pointer text-xs font-extrabold text-ink-primary shadow-hard-sm hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} />
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="p-16 text-center text-xs font-bold text-ink-muted bg-surface border-2 border-black rounded-sm shadow-hard">
          Fetching SHOW GRANTS for all roles…
        </div>
      )}

      {isError && (
        <div className="p-4 bg-status-danger-subtle border-2 border-black rounded-sm text-status-danger-text text-xs font-bold flex gap-2.5 items-center shadow-hard-sm">
          <AlertCircle size={16} strokeWidth={2} />
          <span>Failed to load privilege proof. Ensure you are logged in as ADMIN.</span>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {ROLE_ORDER.map((role) => (
            <RolePanel
              key={role}
              role={role}
              lines={data.grants[role] ?? [`-- No grants found for ${role}`]}
            />
          ))}
        </div>
      )}

      <p className="text-xs font-medium text-ink-secondary mt-5">
        Generated live from MySQL SHOW GRANTS. Colour coding: green = GRANT, saffron = EXECUTE, red = SELECT on sensitive tables (privilege leak).
      </p>
    </div>
  );
}
