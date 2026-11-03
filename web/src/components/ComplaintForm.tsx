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

function StatusBadge({ status }: { status: string }) {
  const getStyle = () => {
    switch (status) {
      case 'OPEN':
        return 'bg-paper text-black';
      case 'SEEN':
        return 'bg-surface-subtle text-black';
      case 'IN_PROGRESS':
        return 'bg-saffron text-black';
      case 'RESOLVED':
        return 'bg-status-success-bg text-black';
      case 'REJECTED':
        return 'bg-status-danger-bg text-black';
      default:
        return 'bg-paper text-black';
    }
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold border-2 border-black ${getStyle()}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const getStyle = () => {
    switch (severity) {
      case 'LOW':
        return 'bg-white text-black';
      case 'MEDIUM':
        return 'bg-paper text-black';
      case 'HIGH':
        return 'bg-saffron text-black';
      case 'URGENT':
        return 'bg-status-danger-bg text-black';
      default:
        return 'bg-paper text-black';
    }
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold border-2 border-black ${getStyle()}`}
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
    <div className="mt-4">
      {/* Filed event */}
      <div className="flex gap-3 mb-4">
        <div className="shrink-0 flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-saffron border-2 border-black flex items-center justify-center shadow-hard-sm">
            <Send size={13} strokeWidth={2} className="text-black" />
          </div>
          {complaint.responses.length > 0 && (
            <div className="w-0.5 flex-1 bg-black mt-1" />
          )}
        </div>
        <div className="pb-2">
          <div className="font-heading font-bold text-sm text-black">
            Complaint Filed
          </div>
          <div className="text-xs text-black/70 font-sans tabular-nums">
            {formatIST(complaint.created_at)}
          </div>
          <div className="mt-1 flex gap-2">
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
          <div key={r.response_id} className="flex gap-3 mb-4">
            <div className="shrink-0 flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full border-2 border-black flex items-center justify-center shadow-hard-sm ${isAuthority ? 'bg-surface-subtle' : 'bg-status-success-bg'}`}>
                <ChevronRight size={13} strokeWidth={2.5} className="text-black" />
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 bg-black mt-1" />
              )}
            </div>
            <div className="pb-2 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm text-black">
                  {r.responder_name}
                </span>
                <span className="text-[10px] font-heading font-bold text-black bg-white border-2 border-black rounded-[4px] px-1.5 py-0.5">
                  {r.responder_role}
                </span>
                {r.new_status && <StatusBadge status={r.new_status} />}
              </div>
              <div className="text-xs text-black/70 font-sans tabular-nums mt-0.5">
                {formatIST(r.created_at)}
              </div>
              <div className="mt-1.5 p-3 bg-surface-subtle/20 border-2 border-black rounded-[4px] text-xs text-black leading-relaxed font-sans">
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
    <div className="bg-white border-2 border-black rounded-[4px] mb-3 overflow-hidden shadow-hard">
      {/* Header */}
      <div
        onClick={() => setExpanded((v) => !v)}
        className={`p-3 sm:p-4 flex items-center justify-between cursor-pointer transition-colors ${
          expanded ? 'bg-paper border-b-2 border-black' : 'bg-white hover:bg-paper/40'
        }`}
      >
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatusBadge status={complaint.status} />
            <SeverityBadge severity={complaint.severity} />
            <span className="text-[10px] font-heading font-bold text-black bg-white border-2 border-black rounded-[4px] px-1.5 py-0.5">
              {complaint.category}
            </span>
            {complaint.is_anonymous && (
              <span className="text-[10px] font-heading font-bold text-black bg-saffron border-2 border-black rounded-[4px] px-1.5 py-0.5">
                ANONYMOUS
              </span>
            )}
          </div>
          <div className="font-heading font-bold text-base text-black">
            {complaint.subject}
          </div>
          <div className="text-xs text-black/70 font-sans mt-0.5">
            To: {complaint.authority_name} ({complaint.authority_designation})
            {complaint.authority_hostel && ` — ${complaint.authority_hostel}`}
            {' · '}
            <span className="tabular-nums font-mono">{formatIST(complaint.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono font-bold bg-saffron text-black px-2 py-0.5 rounded-[4px] border-2 border-black shadow-hard-sm">
            {complaint.tracking_code}
          </code>
          <ChevronRight
            size={18}
            strokeWidth={2}
            className={`text-black transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      {/* Expanded: timeline + reply */}
      {expanded && (
        <div className="p-4 bg-white space-y-4">
          {complaint.escalated_at && (
            <div className="p-3 bg-paper border-2 border-black rounded-[4px] flex gap-2 items-center text-xs text-black font-heading font-bold shadow-hard-sm">
              <AlertCircle size={15} strokeWidth={2} className="text-black shrink-0" />
              <span>
                Escalated to {complaint.escalated_to_authority_name} on{' '}
                <span className="tabular-nums font-mono">
                  {formatIST(complaint.escalated_at)}
                </span>
              </span>
            </div>
          )}

          <ComplaintTimeline complaint={complaint} />

          {complaint.status !== 'REJECTED' && (
            <button
              onClick={() => onReply(complaint.complaint_id)}
              className="mt-2 px-4 py-2 bg-black text-white text-xs font-heading font-bold rounded-[8px] border-2 border-black hover:bg-black/80 flex items-center gap-1.5 shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] transition-all"
            >
              <Send size={13} strokeWidth={2} />
              <span>Reply</span>
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white border-2 border-black rounded-[4px] max-w-md w-full shadow-hard-xl p-6">
        <h3 className="text-base font-heading font-extrabold text-black mb-4">
          Submit Reply
        </h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Type your reply here…"
          className="w-full border-2 border-black rounded-[8px] p-2.5 text-xs text-black bg-white font-sans focus:outline-none focus:shadow-hard"
        />
        {mutation.error && (
          <div className="mt-2 text-xs text-status-danger-text font-medium font-sans">
            {(mutation.error as Error).message}
          </div>
        )}
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-black text-xs font-heading font-bold rounded-[8px] border-2 border-black hover:bg-paper shadow-hard-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!message.trim() || mutation.isPending}
            className="px-4 py-2 bg-black text-white text-xs font-heading font-bold rounded-[8px] border-2 border-black hover:bg-black/80 flex items-center gap-1.5 shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
          >
            <Send size={13} strokeWidth={2} />
            <span>{mutation.isPending ? 'Submitting…' : 'Submit Reply'}</span>
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
    <div className="p-4 sm:p-5 bg-saffron border-2 border-black rounded-[4px] flex items-center justify-between mb-6 shadow-hard-lg">
      <div>
        <div className="text-xs font-heading font-extrabold text-black uppercase tracking-wider">
          COMPLAINT FILED — TRACKING CODE
        </div>
        <code className="text-xl sm:text-2xl font-mono font-bold text-black tracking-wider block mt-1">
          {code}
        </code>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="px-3 py-1.5 bg-white text-black border-2 border-black rounded-[8px] font-heading font-bold text-xs flex items-center gap-1.5 shadow-hard-sm hover:bg-paper active:translate-x-[2px] active:translate-y-[2px] transition-all"
      >
        {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
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

  const fieldClasses = "w-full border-2 border-black rounded-[8px] px-3 py-2 text-sm text-black bg-white font-sans focus:outline-none focus:shadow-hard";
  const labelClasses = "block text-xs font-heading font-bold text-black mb-1";
  const errClasses = "text-xs text-status-danger-text font-medium font-sans mt-1";

  return (
    <div>
      <div className="mb-4">
        <label className={labelClasses}>Authority *</label>
        <select
          value={form.authority_id}
          onChange={(e) => setForm({ ...form, authority_id: e.target.value })}
          className={fieldClasses}
        >
          <option value="">— Select Authority —</option>
          {authoritiesData?.authorities?.map((a) => (
            <option key={a.authority_id} value={a.authority_id}>
              {a.full_name} · {a.designation.replace('_', ' ')}
              {a.hostel_name ? ` (${a.hostel_name})` : ' (Campus-wide)'}
            </option>
          ))}
        </select>
        {errors.authority_id && <div className={errClasses}>{errors.authority_id}</div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClasses}>Category *</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={fieldClasses}
          >
            {['ELECTRICAL','PLUMBING','MESS','CLEANLINESS','CONDUCT','OTHER'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses}>Severity *</label>
          <select
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
            className={fieldClasses}
          >
            {['LOW','MEDIUM','HIGH','URGENT'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className={labelClasses}>Subject *</label>
        <input
          type="text"
          value={form.subject}
          maxLength={160}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="Brief title for your complaint"
          className={fieldClasses}
        />
        {errors.subject && <div className={errClasses}>{errors.subject}</div>}
      </div>

      <div className="mb-4">
        <label className={labelClasses}>Description *</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={5}
          maxLength={4000}
          placeholder="Describe your complaint in detail…"
          className={`${fieldClasses} resize-vertical`}
        />
        <div className="text-[11px] text-black/60 mt-1 text-right tabular-nums font-mono">
          {form.description.length}/4000
        </div>
        {errors.description && <div className={errClasses}>{errors.description}</div>}
      </div>

      {/* Anonymous toggle */}
      <div className="mb-5 p-3 sm:p-4 bg-surface-subtle/20 border-2 border-black rounded-[4px] flex items-center justify-between">
        <div>
          <div className="font-heading font-bold text-sm text-black flex gap-2 items-center">
            {form.is_anonymous ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
            <span>File Anonymously</span>
          </div>
          <div className="text-xs text-black/70 font-sans mt-0.5">
            Your identity will be hidden from the authority. You can still track via your code.
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_anonymous}
            onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-white border-2 border-black rounded-full peer peer-checked:bg-saffron transition-colors relative">
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-black rounded-full transition-transform ${form.is_anonymous ? 'translate-x-5' : ''}`} />
          </div>
        </label>
      </div>

      {mutation.error && (
        <div className="mb-4 p-3 bg-status-danger-bg border-2 border-black rounded-[4px] flex gap-2 items-center text-xs text-black shadow-hard-sm">
          <AlertCircle size={15} strokeWidth={2} className="text-black shrink-0" />
          <span className="font-medium font-sans">{(mutation.error as Error).message}</span>
        </div>
      )}

      <button
        onClick={() => { if (validate()) mutation.mutate(); }}
        disabled={mutation.isPending}
        className="w-full py-2.5 bg-black text-white text-sm font-heading font-bold rounded-[8px] border-2 border-black hover:bg-black/80 flex items-center justify-center gap-2 shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] transition-all disabled:opacity-50"
      >
        <Send size={15} strokeWidth={2} />
        <span>{mutation.isPending ? 'Filing Complaint…' : 'Submit Complaint'}</span>
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

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <h1 className="text-2xl font-heading font-extrabold text-black tracking-tight mb-1">
        Complaints Portal
      </h1>
      <p className="text-xs text-black/70 font-sans mb-6">
        File confidential complaints addressed directly to hostel authorities.
      </p>

      {/* Tabs */}
      <div className="flex gap-2 border-b-2 border-black mb-6">
        <button
          onClick={() => setActiveTab('file')}
          className={`px-4 py-2 text-xs font-heading font-bold rounded-t-[8px] border-2 border-b-0 border-black transition-colors ${
            activeTab === 'file'
              ? 'bg-black text-white shadow-hard-sm'
              : 'bg-white text-black hover:bg-saffron'
          }`}
        >
          File a Complaint
        </button>
        <button
          onClick={() => setActiveTab('mine')}
          className={`px-4 py-2 text-xs font-heading font-bold rounded-t-[8px] border-2 border-b-0 border-black transition-colors ${
            activeTab === 'mine'
              ? 'bg-black text-white shadow-hard-sm'
              : 'bg-white text-black hover:bg-saffron'
          }`}
        >
          My Complaints
        </button>
      </div>

      {activeTab === 'file' && (
        <div>
          {trackingCode && (
            <TrackingCodeBanner code={trackingCode} />
          )}
          <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard-lg">
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
            <div className="text-center py-12 text-black/70 font-sans text-xs">
              Loading complaints…
            </div>
          ) : data?.complaints?.length === 0 ? (
            <div className="text-center py-12 bg-white border-2 border-black rounded-[4px] text-black/70 font-sans text-xs shadow-hard">
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
