import { useState, type ReactNode, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ChevronDown, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type GrantsResponse = { grants: Record<string, string[]> };

const ROLE_ORDER = [
  'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN',
  'MESS_MANAGER', 'CARETAKER', 'STUDENT',
];

const ROLE_COLORS: Record<string, { badge: string; badgeBg: string; badgeBorder: string }> = {
  ADMIN:         { badge: '#DC2626', badgeBg: '#FEF2F2', badgeBorder: '#FECACA' },
  HOSTEL_OFFICE: { badge: '#7C3AED', badgeBg: '#F5F3FF', badgeBorder: '#DDD6FE' },
  CHIEF_WARDEN:  { badge: '#1D4ED8', badgeBg: '#EFF6FF', badgeBorder: '#BFDBFE' },
  WARDEN:        { badge: '#2563EB', badgeBg: '#EFF6FF', badgeBorder: '#BFDBFE' },
  MESS_MANAGER:  { badge: '#059669', badgeBg: '#ECFDF5', badgeBorder: '#A7F3D0' },
  CARETAKER:     { badge: '#D97706', badgeBg: '#FFFBEB', badgeBorder: '#FDE68A' },
  STUDENT:       { badge: '#4B5563', badgeBg: '#F3F4F6', badgeBorder: '#E5E7EB' },
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

  let color = '#E2E8F0';
  if (isRevoke || hasSelect) color = '#FCA5A5'; // danger — complaint select leak
  else if (hasAll) color = '#86EFAC';           // green — full
  else if (isGrant && hasExec) color = '#93C5FD'; // blue — execute
  else if (isGrant) color = '#D9F99D';           // lime — grant

  return (
    <span style={{ color, display: 'block', lineHeight: 1.6 }}>{line}</span>
  );
}

// ─── Role Panel ───────────────────────────────────────────────────────────────
function RolePanel({ role, lines }: { role: string; lines: string[] }) {
  const [open, setOpen] = useState(role === 'STUDENT'); // open student by default
  const { hasComplaintSelect, hasExecute } = analyzeGrants(lines);
  const rc = ROLE_COLORS[role] ?? ROLE_COLORS.STUDENT;

  return (
    <div style={{
      marginBottom: 10, border: '1px solid #E2E8F0',
      borderRadius: 8, overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '12px 16px', background: '#F8FAFC',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', userSelect: 'none',
          borderBottom: open ? '1px solid #E2E8F0' : 'none',
        }}
      >
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          color: rc.badge, background: rc.badgeBg, border: `1px solid ${rc.badgeBorder}`,
          borderRadius: 9999, padding: '2px 10px',
        }}>
          {role}
        </span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasComplaintSelect ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
              <AlertCircle size={13} strokeWidth={1.75} />
              SELECT on complaints DETECTED — privilege leak!
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#059669', fontWeight: 600 }}>
              <CheckCircle size={13} strokeWidth={1.75} />
              No SELECT on complaints/complaint_responses
            </span>
          )}
          {hasExecute && (
            <span style={{ fontSize: 12, color: '#2563EB' }}>· EXECUTE granted</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
            {lines.length} grant{lines.length !== 1 ? 's' : ''}
          </span>
        </div>
        {open ? (
          <ChevronDown size={15} strokeWidth={1.75} color="#64748B" />
        ) : (
          <ChevronRight size={15} strokeWidth={1.75} color="#64748B" />
        )}
      </div>

      {/* Grant lines */}
      {open && (
        <pre style={{
          margin: 0, padding: '14px 18px',
          background: '#0F172A', fontSize: 12,
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.6, overflowX: 'auto',
          maxHeight: 400, overflowY: 'auto',
        }}>
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
  const { data, isLoading, isError, refetch } = useQuery({
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
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
        <div style={{
          width: 40, height: 40, background: '#EEF2FF',
          border: '1px solid #C7D2FE', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck size={20} strokeWidth={1.75} color="#2F5BD6" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>
            Privilege Proof
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#64748B' }}>
            Live SHOW GRANTS output per role — verifies complaint table isolation
          </p>
        </div>
      </div>

      {/* Summary banner */}
      {data && (
        <div style={{
          margin: '20px 0', padding: '12px 16px',
          background: allClean ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${allClean ? '#A7F3D0' : '#FECACA'}`,
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {allClean ? (
            <CheckCircle size={18} strokeWidth={1.75} color="#059669" />
          ) : (
            <AlertCircle size={18} strokeWidth={1.75} color="#DC2626" />
          )}
          <span style={{ fontWeight: 600, fontSize: 14, color: allClean ? '#059669' : '#DC2626' }}>
            {allClean
              ? 'All 7 roles confirmed: NO SELECT privilege on complaints or complaint_responses.'
              : 'WARNING: One or more roles has SELECT on complaints / complaint_responses!'}
          </span>
          <button
            onClick={() => refetch()}
            style={{
              marginLeft: 'auto', padding: '5px 14px',
              border: '1px solid #E2E8F0', borderRadius: 6,
              background: '#FFFFFF', cursor: 'pointer',
              fontSize: 13, color: '#475569',
            }}
          >
            Refresh
          </button>
        </div>
      )}

      {isLoading && (
        <div style={{ padding: 64, textAlign: 'center', color: '#64748B', fontSize: 14 }}>
          Fetching SHOW GRANTS for all roles…
        </div>
      )}
      {isError && (
        <div style={{
          padding: 24, background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 8, color: '#DC2626', fontSize: 14,
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <AlertCircle size={16} strokeWidth={1.75} />
          Failed to load privilege proof. Ensure you are logged in as ADMIN.
        </div>
      )}

      {data && (
        <div>
          {ROLE_ORDER.map((role) => (
            <RolePanel
              key={role}
              role={role}
              lines={data.grants[role] ?? [`-- No grants found for ${role}`]}
            />
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 20 }}>
        Generated live from MySQL SHOW GRANTS. Colour coding: green = GRANT, blue = EXECUTE, red = SELECT on sensitive tables (privilege leak).
      </p>
    </div>
  );
}
