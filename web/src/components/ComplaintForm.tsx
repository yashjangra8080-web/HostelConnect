import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Send, Eye, EyeOff, Copy, Check, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Authority {
  authority_id: number;
  designation: string;
  full_name: string;
  hostel_name: string | null;
}

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
  authority_name: string;
  authority_designation: string;
  authority_hostel: string | null;
  category: string;
  severity: string;
  subject: string;
  description: string;
  is_anonymous: boolean;
  status: string;
  escalated_at: string | null;
  escalated_to_authority_name: string | null;
  created_at: string;
  responses: ComplaintResponse[];
}

// ─── Status badge colour map ──────────────────────────────────────────────────
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

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.OPEN;
  return (
    <span
      style={{
        color: s.text, background: s.bg, border: `1px solid ${s.border}`,
        borderRadius: 9999, fontSize: 11, fontWeight: 600,
        padding: '2px 8px', display: 'inline-block',
      }}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.MEDIUM;
  return (
    <span
      style={{
        color: s.text, background: s.bg, border: `1px solid ${s.border}`,
        borderRadius: 9999, fontSize: 11, fontWeight: 600,
        padding: '2px 8px', display: 'inline-block',
      }}
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

// ─── Complaint Timeline ───────────────────────────────────────────────────────
function ComplaintTimeline({ complaint }: { complaint: Complaint }) {
  return (
    <div style={{ marginTop: 16 }}>
      {/* Filed event */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#EEF2FF', border: '2px solid #2F5BD6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Send size={13} strokeWidth={1.75} color="#2F5BD6" />
          </div>
          {complaint.responses.length > 0 && (
            <div style={{ width: 2, flex: 1, background: '#E2E8F0', marginTop: 4 }} />
          )}
        </div>
        <div style={{ paddingBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>
            Complaint Filed
          </div>
          <div style={{ fontSize: 12, color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
            {formatIST(complaint.created_at)}
          </div>
          <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
            <StatusBadge status="OPEN" />
            <SeverityBadge severity={complaint.severity} />
          </div>
        </div>
      </div>

      {/* Response events */}
      {complaint.responses.map((r, idx) => {
        const isLast = idx === complaint.responses.length - 1;
        const isAuthority = r.responder_role !== 'STUDENT';
        return (
          <div key={r.response_id} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: isAuthority ? '#EEF2FF' : '#ECFDF5',
                border: `2px solid ${isAuthority ? '#2F5BD6' : '#059669'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ChevronRight size={13} strokeWidth={1.75} color={isAuthority ? '#2F5BD6' : '#059669'} />
              </div>
              {!isLast && (
                <div style={{ width: 2, flex: 1, background: '#E2E8F0', marginTop: 4 }} />
              )}
            </div>
            <div style={{ paddingBottom: 8, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>
                  {r.responder_name}
                </span>
                <span style={{ fontSize: 11, color: '#64748B', background: '#F3F4F6',
                  border: '1px solid #E5E7EB', borderRadius: 9999, padding: '1px 6px' }}>
                  {r.responder_role}
                </span>
                {r.new_status && <StatusBadge status={r.new_status} />}
              </div>
              <div style={{ fontSize: 12, color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                {formatIST(r.created_at)}
              </div>
              <div style={{
                marginTop: 6, padding: '8px 12px',
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: 6, fontSize: 13, color: '#0F172A', lineHeight: 1.5,
              }}>
                {r.message}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Complaint Card ────────────────────────────────────────────────────────────
function ComplaintCard({
  complaint,
  onReply,
}: {
  complaint: Complaint;
  onReply: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E2E8F0',
      borderRadius: 8, marginBottom: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          padding: '12px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', cursor: 'pointer',
          background: expanded ? '#F8FAFC' : '#FFFFFF',
          borderBottom: expanded ? '1px solid #E2E8F0' : 'none',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <StatusBadge status={complaint.status} />
            <SeverityBadge severity={complaint.severity} />
            <span style={{
              fontSize: 11, color: '#64748B', background: '#F3F4F6',
              border: '1px solid #E5E7EB', borderRadius: 9999, padding: '1px 6px', fontWeight: 600,
            }}>
              {complaint.category}
            </span>
            {complaint.is_anonymous && (
              <span style={{ fontSize: 11, color: '#7C3AED', background: '#F5F3FF',
                border: '1px solid #DDD6FE', borderRadius: 9999, padding: '1px 6px', fontWeight: 600 }}>
                ANONYMOUS
              </span>
            )}
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>
            {complaint.subject}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
            To: {complaint.authority_name} ({complaint.authority_designation})
            {complaint.authority_hostel && ` — ${complaint.authority_hostel}`}
            {' · '}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatIST(complaint.created_at)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{
            fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
            background: '#F3F4F6', padding: '2px 8px', borderRadius: 4,
            color: '#475569', letterSpacing: '0.05em',
          }}>
            {complaint.tracking_code}
          </code>
          <ChevronRight
            size={16} strokeWidth={1.75} color="#64748B"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </div>
      </div>

      {/* Expanded: timeline + reply */}
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {complaint.escalated_at && (
            <div style={{
              margin: '12px 0', padding: '8px 12px',
              background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <AlertCircle size={14} strokeWidth={1.75} color="#D97706" />
              <span style={{ fontSize: 13, color: '#D97706', fontWeight: 500 }}>
                Escalated to {complaint.escalated_to_authority_name} on{' '}
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatIST(complaint.escalated_at)}
                </span>
              </span>
            </div>
          )}

          <ComplaintTimeline complaint={complaint} />

          {complaint.status !== 'REJECTED' && (
            <button
              onClick={() => onReply(complaint.complaint_id)}
              style={{
                marginTop: 8, padding: '8px 16px',
                background: '#2F5BD6', color: '#FFFFFF',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontWeight: 500, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Send size={14} strokeWidth={1.75} />
              Reply
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reply Modal ───────────────────────────────────────────────────────────────
function ReplyModal({
  complaintId,
  onClose,
  csrfToken,
}: {
  complaintId: number;
  onClose: () => void;
  csrfToken: string;
}) {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/complaints/${complaintId}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Failed to submit reply');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
      onClose();
    },
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 10, width: 480,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)', padding: 24,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
          Submit Reply
        </h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Type your reply here…"
          style={{
            width: '100%', boxSizing: 'border-box',
            border: '1px solid #E2E8F0', borderRadius: 6, padding: '10px 12px',
            fontSize: 14, color: '#0F172A', resize: 'vertical',
            outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
          }}
        />
        {mutation.error && (
          <div style={{ marginTop: 8, color: '#DC2626', fontSize: 13 }}>
            {(mutation.error as Error).message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', background: 'transparent',
              border: '1px solid #E2E8F0', borderRadius: 6,
              cursor: 'pointer', fontSize: 14, color: '#475569',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!message.trim() || mutation.isPending}
            style={{
              padding: '8px 16px', background: '#2F5BD6', color: '#FFFFFF',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontWeight: 500, fontSize: 14, opacity: mutation.isPending ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Send size={14} strokeWidth={1.75} />
            {mutation.isPending ? 'Submitting…' : 'Submit Reply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tracking Code Banner ─────────────────────────────────────────────────────
function TrackingCodeBanner({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div style={{
      padding: '16px 20px', background: '#ECFDF5',
      border: '1px solid #A7F3D0', borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 24,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', letterSpacing: '0.05em' }}>
          COMPLAINT FILED — TRACKING CODE
        </div>
        <code style={{
          fontSize: 20, fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 500, color: '#0F172A', letterSpacing: '0.08em',
        }}>
          {code}
        </code>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        style={{
          padding: '6px 12px', background: copied ? '#059669' : '#FFFFFF',
          border: '1px solid #A7F3D0', borderRadius: 6,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 500, color: copied ? '#FFFFFF' : '#059669',
          transition: 'all 0.15s',
        }}
      >
        {copied ? <Check size={14} strokeWidth={1.75} /> : <Copy size={14} strokeWidth={1.75} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// ─── Complaint Filing Form ────────────────────────────────────────────────────
function ComplaintFilingForm({
  csrfToken,
  onFiled,
}: {
  csrfToken: string;
  onFiled: (code: string) => void;
}) {
  const [form, setForm] = useState({
    authority_id: '',
    category: 'OTHER',
    severity: 'MEDIUM',
    subject: '',
    description: '',
    is_anonymous: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: authoritiesData } = useQuery({
    queryKey: ['authorities-list'],
    queryFn: async () => {
      const res = await fetch('/api/lookups/authorities', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load authorities');
      return res.json() as Promise<{ authorities: Authority[] }>;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          ...form,
          authority_id: parseInt(form.authority_id, 10),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Failed to file complaint');
      }
      return res.json();
    },
    onSuccess: (data) => onFiled(data.tracking_code),
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.authority_id) e.authority_id = 'Please select an authority.';
    if (form.subject.trim().length < 3) e.subject = 'Subject must be at least 3 characters.';
    if (form.description.trim().length < 10) e.description = 'Description must be at least 10 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    border: '1px solid #E2E8F0', borderRadius: 6, padding: '9px 12px',
    fontSize: 16, color: '#0F172A', background: '#FFFFFF', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
  };
  const labelStyle = { display: 'block' as const, fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 };
  const errStyle = { fontSize: 12, color: '#DC2626', marginTop: 4 };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Authority *</label>
        <select
          value={form.authority_id}
          onChange={(e) => setForm({ ...form, authority_id: e.target.value })}
          style={fieldStyle}
        >
          <option value="">— Select Authority —</option>
          {authoritiesData?.authorities?.map((a) => (
            <option key={a.authority_id} value={a.authority_id}>
              {a.full_name} · {a.designation.replace('_', ' ')}
              {a.hostel_name ? ` (${a.hostel_name})` : ' (Campus-wide)'}
            </option>
          ))}
        </select>
        {errors.authority_id && <div style={errStyle}>{errors.authority_id}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Category *</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={fieldStyle}>
            {['ELECTRICAL','PLUMBING','MESS','CLEANLINESS','CONDUCT','OTHER'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Severity *</label>
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} style={fieldStyle}>
            {['LOW','MEDIUM','HIGH','URGENT'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Subject *</label>
        <input
          type="text"
          value={form.subject}
          maxLength={160}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="Brief title for your complaint"
          style={fieldStyle}
        />
        {errors.subject && <div style={errStyle}>{errors.subject}</div>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Description *</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={5}
          maxLength={4000}
          placeholder="Describe your complaint in detail…"
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {form.description.length}/4000
        </div>
        {errors.description && <div style={errStyle}>{errors.description}</div>}
      </div>

      {/* Anonymous toggle */}
      <div style={{
        marginBottom: 20, padding: '12px 16px',
        background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A', display: 'flex', gap: 8, alignItems: 'center' }}>
            {form.is_anonymous ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
            File Anonymously
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
            Your identity will be hidden from the authority. You can still track via your code.
          </div>
        </div>
        <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.is_anonymous}
            onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <div style={{
            width: 40, height: 22, background: form.is_anonymous ? '#2F5BD6' : '#CBD5E1',
            borderRadius: 11, position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: 3, left: form.is_anonymous ? 21 : 3,
              width: 16, height: 16, background: '#FFFFFF', borderRadius: '50%',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
        </label>
      </div>

      {mutation.error && (
        <div style={{
          marginBottom: 16, padding: '10px 14px',
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <AlertCircle size={15} strokeWidth={1.75} color="#DC2626" />
          <span style={{ fontSize: 13, color: '#DC2626' }}>{(mutation.error as Error).message}</span>
        </div>
      )}

      <button
        onClick={() => { if (validate()) mutation.mutate(); }}
        disabled={mutation.isPending}
        style={{
          width: '100%', padding: '10px 0',
          background: mutation.isPending ? '#6B8FDE' : '#2F5BD6',
          color: '#FFFFFF', border: 'none', borderRadius: 6,
          fontWeight: 500, fontSize: 16, cursor: mutation.isPending ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <Send size={16} strokeWidth={1.75} />
        {mutation.isPending ? 'Filing Complaint…' : 'Submit Complaint'}
      </button>
    </div>
  );
}

// ─── Main ComplaintForm Page ──────────────────────────────────────────────────
export function ComplaintForm({ csrfToken }: { csrfToken: string }) {
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'file' | 'mine'>('file');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: async () => {
      const res = await fetch('/api/complaints/mine', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load complaints');
      return res.json() as Promise<{ complaints: Complaint[] }>;
    },
    enabled: activeTab === 'mine',
  });

  const tabStyle = (active: boolean) => ({
    padding: '9px 20px', fontSize: 14, fontWeight: 500,
    background: active ? '#2F5BD6' : 'transparent',
    color: active ? '#FFFFFF' : '#475569',
    border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
  });

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
        Complaints Portal
      </h1>
      <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 24px' }}>
        File confidential complaints addressed directly to hostel authorities.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: 24 }}>
        <button style={tabStyle(activeTab === 'file')} onClick={() => setActiveTab('file')}>
          File a Complaint
        </button>
        <button style={tabStyle(activeTab === 'mine')} onClick={() => setActiveTab('mine')}>
          My Complaints
        </button>
      </div>

      {activeTab === 'file' && (
        <div>
          {trackingCode && (
            <TrackingCodeBanner code={trackingCode} />
          )}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0',
            borderRadius: 8, padding: 24,
          }}>
            <ComplaintFilingForm
              csrfToken={csrfToken}
              onFiled={(code) => {
                setTrackingCode(code);
                queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
              }}
            />
          </div>
        </div>
      )}

      {activeTab === 'mine' && (
        <div>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#64748B' }}>
              Loading complaints…
            </div>
          ) : data?.complaints?.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 48,
              background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
              color: '#64748B', fontSize: 14,
            }}>
              You have not filed any complaints yet.
            </div>
          ) : (
            data?.complaints?.map((c) => (
              <ComplaintCard
                key={c.complaint_id}
                complaint={c}
                onReply={(id) => setReplyTarget(id)}
              />
            ))
          )}
        </div>
      )}

      {replyTarget && (
        <ReplyModal
          complaintId={replyTarget}
          csrfToken={csrfToken}
          onClose={() => setReplyTarget(null)}
        />
      )}
    </div>
  );
}
