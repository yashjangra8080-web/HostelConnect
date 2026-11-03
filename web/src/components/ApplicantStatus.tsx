import React, { useState, useEffect } from 'react';
import {
  BedDouble,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Building2,
  AlertTriangle,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { AllotmentStatusResponse } from '../types.js';

interface ApplicantStatusProps {
  onRefresh?: () => void;
}

export const ApplicantStatus: React.FC<ApplicantStatusProps> = ({ onRefresh }) => {
  const [data, setData] = useState<AllotmentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dialog states
  const [confirmAction, setConfirmAction] = useState<'ACCEPT' | 'DECLINE' | 'WITHDRAW' | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/allotment/my-status');
      if (!res.ok) {
        throw new Error(`Failed to load allotment status (${res.statusText})`);
      }
      const json: AllotmentStatusResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRespond = async (response: 'ACCEPTED' | 'DECLINED') => {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/allotment/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to submit response.');
      }
      setSuccessMessage(
        response === 'ACCEPTED'
          ? 'Congratulations! Your room allotment has been accepted.'
          : 'You have declined the allotment. The seat has been released to the next waitlisted applicant.'
      );
      setConfirmAction(null);
      await fetchStatus();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/allotment/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to withdraw application.');
      }
      setSuccessMessage('Your application has been safely withdrawn.');
      setConfirmAction(null);
      await fetchStatus();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-surface border-2 border-black rounded-sm p-12 text-center text-xs font-bold text-ink-muted shadow-hard">
        Loading your allotment status...
      </div>
    );
  }

  const allotment = data?.allotment;
  const application = data?.application;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Card */}
      <div className="bg-surface border-2 border-black rounded-sm p-6 shadow-hard-lg">
        <div className="flex items-center justify-between pb-4 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-paper border-2 border-black flex items-center justify-center text-ink-primary shadow-hard-sm">
              <BedDouble className="w-5 h-5 text-ink-primary" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold font-heading text-ink-primary tracking-tight">Hostel Allotment Status</h2>
              <p className="text-xs font-medium text-ink-secondary">Academic Year 2026-27 &bull; Cycle Status: <span className="font-mono font-bold text-ink-primary">{data?.cycle_status || 'UNKNOWN'}</span></p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            className="p-2 rounded-sm text-ink-primary bg-surface hover:bg-paper border-2 border-black shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
          </button>
        </div>

        {/* Notifications / Alerts */}
        {error && (
          <div className="mt-4 p-4 bg-status-danger-subtle border-2 border-black rounded-sm text-xs font-bold text-status-danger-text flex items-center gap-2 shadow-hard-sm">
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-4 bg-status-success-subtle border-2 border-black rounded-sm text-xs font-bold text-status-success-text flex items-center gap-2 shadow-hard-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Allotted Case */}
        {data?.has_allotment && allotment ? (
          <div className="mt-6 space-y-6">
            <div className="p-5 bg-status-success-subtle border-2 border-black rounded-sm shadow-hard flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-sm bg-surface border-2 border-black flex items-center justify-center text-status-success-text shadow-hard-sm shrink-0">
                  <CheckCircle2 className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-extrabold text-base text-ink-primary tracking-tight">
                      Hostel Accommodation Allotted!
                    </span>
                    <span
                      className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-sm border-2 border-black shadow-hard-sm ${
                        allotment.response_status === 'ACCEPTED'
                          ? 'bg-status-success-subtle text-status-success-text'
                          : allotment.response_status === 'DECLINED'
                          ? 'bg-status-danger-subtle text-status-danger-text'
                          : 'bg-saffron text-black'
                      }`}
                    >
                      {allotment.response_status}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-ink-secondary mt-1">
                    You have been provisionally allotted a room in the NSUT Dwarka campus hostel complex.
                  </p>
                </div>
              </div>

              {allotment.response_status === 'AWAITING' && allotment.response_deadline && (
                <div className="text-right shrink-0 bg-surface px-4 py-2 rounded-sm border-2 border-black shadow-hard-sm">
                  <span className="text-[10px] uppercase tracking-wider text-ink-muted block font-extrabold">
                    Response Deadline
                  </span>
                  <span className="text-xs font-mono font-bold text-status-danger-text tabular-nums">
                    {new Date(allotment.response_deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                </div>
              )}
            </div>

            {/* Allotment Details Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-surface border-2 border-black rounded-sm shadow-hard">
                <div className="flex items-center gap-2 text-xs font-bold text-ink-secondary mb-1">
                  <Building2 className="w-4 h-4 text-ink-primary" strokeWidth={2} />
                  <span>Hostel Block</span>
                </div>
                <div className="text-base font-extrabold font-heading text-ink-primary">
                  {allotment.hostel_name}
                </div>
              </div>

              <div className="p-4 bg-surface border-2 border-black rounded-sm shadow-hard">
                <div className="flex items-center gap-2 text-xs font-bold text-ink-secondary mb-1">
                  <Layers className="w-4 h-4 text-ink-primary" strokeWidth={2} />
                  <span>Room & Floor</span>
                </div>
                <div className="text-base font-extrabold font-heading text-ink-primary">
                  Room {allotment.room_no} &bull; Floor {allotment.floor_no}
                </div>
              </div>

              <div className="p-4 bg-surface border-2 border-black rounded-sm shadow-hard">
                <div className="flex items-center gap-2 text-xs font-bold text-ink-secondary mb-1">
                  <Clock className="w-4 h-4 text-ink-primary" strokeWidth={2} />
                  <span>Allotted Timestamp (IST)</span>
                </div>
                <div className="text-xs font-mono font-bold text-ink-primary tabular-nums mt-1">
                  {new Date(allotment.allotted_on).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
              </div>
            </div>

            {/* Action Buttons if Awaiting Response */}
            {allotment.response_status === 'AWAITING' && (
              <div className="p-5 bg-surface border-2 border-black rounded-sm shadow-hard flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-extrabold font-heading text-ink-primary tracking-tight">Submit Allotment Response</h4>
                  <p className="text-xs font-medium text-ink-secondary mt-0.5">
                    Please confirm whether you accept or decline this allotment before the deadline.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setConfirmAction('ACCEPT')}
                    className="flex-1 sm:flex-none px-4 py-2 text-xs font-extrabold rounded-sm bg-status-success-subtle border-2 border-black text-status-success-text shadow-hard hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                    <span>Accept Seat</span>
                  </button>

                  <button
                    onClick={() => setConfirmAction('DECLINE')}
                    className="flex-1 sm:flex-none px-4 py-2 text-xs font-extrabold rounded-sm bg-surface border-2 border-black text-status-danger-text shadow-hard hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" strokeWidth={2} />
                    <span>Decline Seat</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : application ? (
          /* Application exists but not allotted (Waitlisted or Pending) */
          <div className="mt-6 space-y-6">
            <div
              className={`p-5 rounded-sm border-2 border-black shadow-hard flex items-start gap-4 ${
                application.status === 'WAITLISTED'
                  ? 'bg-status-warning-subtle text-status-warning-text'
                  : application.status === 'WITHDRAWN'
                  ? 'bg-surface-subtle text-ink-secondary'
                  : 'bg-paper text-ink-primary'
              }`}
            >
              <div className="mt-0.5">
                {application.status === 'WAITLISTED' ? (
                  <Clock className="w-5 h-5 text-status-warning-text" strokeWidth={2} />
                ) : application.status === 'WITHDRAWN' ? (
                  <XCircle className="w-5 h-5 text-ink-muted" strokeWidth={2} />
                ) : (
                  <AlertCircle className="w-5 h-5 text-ink-primary" strokeWidth={2} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-extrabold text-base tracking-tight text-ink-primary">
                    Application Status: {application.status}
                  </span>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-sm bg-surface border-2 border-black shadow-hard-sm text-ink-primary">
                    Verification: {application.verification_status}
                  </span>
                </div>
                <p className="text-xs font-medium mt-1 text-ink-secondary">
                  {application.status === 'WAITLISTED'
                    ? 'You are currently on the waitlist. If an allotted student of your gender declines their room or vacates, candidates on the waitlist with matching study habits will be automatically promoted.'
                    : application.status === 'WITHDRAWN'
                    ? 'Your application for this cycle was withdrawn.'
                    : 'Your application has been received and is under verification.'}
                </p>
              </div>
            </div>

            {/* Withdraw button for active application */}
            {application.status !== 'WITHDRAWN' && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setConfirmAction('WITHDRAW')}
                  className="px-3 py-1.5 text-xs font-extrabold text-status-danger-text bg-surface hover:bg-status-danger-subtle border-2 border-black rounded-sm shadow-hard-sm hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                >
                  Withdraw My Application
                </button>
              </div>
            )}
          </div>
        ) : (
          /* No application */
          <div className="mt-6 py-12 text-center text-xs font-bold text-ink-muted">
            No application found for your student profile in the active cycle.
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface border-2 border-black rounded-sm shadow-hard-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-sm border-2 border-black shadow-hard-sm flex items-center justify-center shrink-0 ${
                  confirmAction === 'ACCEPT'
                    ? 'bg-status-success-subtle text-status-success-text'
                    : confirmAction === 'DECLINE'
                    ? 'bg-status-danger-subtle text-status-danger-text'
                    : 'bg-saffron text-black'
                }`}
              >
                {confirmAction === 'ACCEPT' ? (
                  <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
                ) : (
                  <AlertTriangle className="w-5 h-5" strokeWidth={2.5} />
                )}
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-sm text-ink-primary tracking-tight">
                  {confirmAction === 'ACCEPT'
                    ? 'Confirm Allotment Acceptance'
                    : confirmAction === 'DECLINE'
                    ? 'Confirm Allotment Decline'
                    : 'Confirm Application Withdrawal'}
                </h3>
                <p className="text-xs font-medium text-ink-secondary mt-1 leading-relaxed">
                  {confirmAction === 'ACCEPT'
                    ? `You are confirming your allotment in Room ${allotment?.room_no}, ${allotment?.hostel_name}. Your seat will be secured.`
                    : confirmAction === 'DECLINE'
                    ? 'Warning: If you decline, your allotted bed will be forfeited immediately and reallocated to the next eligible waitlisted applicant with matching study habit. Your application will be marked WITHDRAWN.'
                    : 'Warning: Withdrawing your application will permanently remove you from the active allotment and waitlist for this cycle.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
              <button
                disabled={submitting}
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-xs font-extrabold rounded-sm bg-surface border-2 border-black text-ink-primary shadow-hard hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                Cancel
              </button>

              <button
                disabled={submitting}
                onClick={() => {
                  if (confirmAction === 'ACCEPT') handleRespond('ACCEPTED');
                  else if (confirmAction === 'DECLINE') handleRespond('DECLINED');
                  else if (confirmAction === 'WITHDRAW') handleWithdraw();
                }}
                className={`px-4 py-2 text-xs font-extrabold rounded-sm border-2 border-black shadow-hard hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-1.5 ${
                  confirmAction === 'ACCEPT'
                    ? 'bg-status-success-subtle text-status-success-text'
                    : 'bg-status-danger-subtle text-status-danger-text'
                }`}
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />}
                <span>
                  {confirmAction === 'ACCEPT'
                    ? 'Accept Room'
                    : confirmAction === 'DECLINE'
                    ? 'Decline & Forfeit'
                    : 'Confirm Withdrawal'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
