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
import { AllotmentStatusResponse } from '../types';

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
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center text-xs text-[#64748B]">
        Loading your allotment status...
      </div>
    );
  }

  const allotment = data?.allotment;
  const application = data?.application;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#EEF2FF] flex items-center justify-center text-[#2F5BD6]">
              <BedDouble className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading text-[#0F172A]">Hostel Allotment Status</h2>
              <p className="text-xs text-[#64748B]">Academic Year 2026-27 &bull; Cycle Status: {data?.cycle_status || 'UNKNOWN'}</p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            className="p-1.5 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          </button>
        </div>

        {/* Notifications / Alerts */}
        {error && (
          <div className="mt-4 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#DC2626] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-xs text-[#059669] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Allotted Case */}
        {data?.has_allotment && allotment ? (
          <div className="mt-6 space-y-6">
            <div className="p-5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#DCFCE7] flex items-center justify-center text-[#15803D] shrink-0">
                  <CheckCircle2 className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-base text-[#15803D]">
                      Hostel Accommodation Allotted!
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        allotment.response_status === 'ACCEPTED'
                          ? 'bg-[#15803D] text-white'
                          : allotment.response_status === 'DECLINED'
                          ? 'bg-[#DC2626] text-white'
                          : 'bg-[#F59E0B] text-white'
                      }`}
                    >
                      {allotment.response_status}
                    </span>
                  </div>
                  <p className="text-xs text-[#166534] mt-1">
                    You have been provisionally allotted a room in the NSUT Dwarka campus hostel complex.
                  </p>
                </div>
              </div>

              {allotment.response_status === 'AWAITING' && allotment.response_deadline && (
                <div className="text-right shrink-0 bg-white/80 px-3.5 py-2 rounded-lg border border-[#BBF7D0]">
                  <span className="text-[10px] uppercase tracking-wider text-[#64748B] block font-semibold">
                    Response Deadline
                  </span>
                  <span className="text-xs font-bold text-[#DC2626] tabular-nums">
                    {new Date(allotment.response_deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                </div>
              )}
            </div>

            {/* Allotment Details Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
                  <Building2 className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
                  <span>Hostel Block</span>
                </div>
                <div className="text-base font-bold font-heading text-[#0F172A]">
                  {allotment.hostel_name}
                </div>
              </div>

              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
                  <Layers className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
                  <span>Room & Floor</span>
                </div>
                <div className="text-base font-bold font-heading text-[#0F172A]">
                  Room {allotment.room_no} &bull; Floor {allotment.floor_no}
                </div>
              </div>

              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
                  <Clock className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
                  <span>Allotted Timestamp (IST)</span>
                </div>
                <div className="text-xs font-semibold text-[#0F172A] tabular-nums mt-1">
                  {new Date(allotment.allotted_on).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
              </div>
            </div>

            {/* Action Buttons if Awaiting Response */}
            {allotment.response_status === 'AWAITING' && (
              <div className="p-5 bg-white border border-[#CBD5E1] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold font-heading text-[#0F172A]">Submit Allotment Response</h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Please confirm whether you accept or decline this allotment before the deadline.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setConfirmAction('ACCEPT')}
                    className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded bg-[#059669] text-white hover:bg-[#047857] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
                    <span>Accept Seat</span>
                  </button>

                  <button
                    onClick={() => setConfirmAction('DECLINE')}
                    className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded bg-white border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" strokeWidth={1.75} />
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
              className={`p-5 rounded-xl border flex items-start gap-4 ${
                application.status === 'WAITLISTED'
                  ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                  : application.status === 'WITHDRAWN'
                  ? 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'
                  : 'bg-[#EEF2FF] border-[#CBD5E1] text-[#1E3A8A]'
              }`}
            >
              <div className="mt-0.5">
                {application.status === 'WAITLISTED' ? (
                  <Clock className="w-5 h-5 text-[#D97706]" strokeWidth={1.75} />
                ) : application.status === 'WITHDRAWN' ? (
                  <XCircle className="w-5 h-5 text-[#64748B]" strokeWidth={1.75} />
                ) : (
                  <AlertCircle className="w-5 h-5 text-[#2F5BD6]" strokeWidth={1.75} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-base">
                    Application Status: {application.status}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/80 border border-current">
                    Verification: {application.verification_status}
                  </span>
                </div>
                <p className="text-xs mt-1 opacity-90">
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
                  className="px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] border border-transparent hover:border-[#FECACA] rounded transition-colors"
                >
                  Withdraw My Application
                </button>
              </div>
            )}
          </div>
        ) : (
          /* No application */
          <div className="mt-6 py-12 text-center text-xs text-[#64748B]">
            No application found for your student profile in the active cycle.
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  confirmAction === 'ACCEPT'
                    ? 'bg-[#DCFCE7] text-[#15803D]'
                    : confirmAction === 'DECLINE'
                    ? 'bg-[#FEE2E2] text-[#DC2626]'
                    : 'bg-[#FEF3C7] text-[#D97706]'
                }`}
              >
                {confirmAction === 'ACCEPT' ? (
                  <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
                ) : (
                  <AlertTriangle className="w-5 h-5" strokeWidth={2} />
                )}
              </div>
              <div>
                <h3 className="font-heading font-bold text-sm text-[#0F172A]">
                  {confirmAction === 'ACCEPT'
                    ? 'Confirm Allotment Acceptance'
                    : confirmAction === 'DECLINE'
                    ? 'Confirm Allotment Decline'
                    : 'Confirm Application Withdrawal'}
                </h3>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                  {confirmAction === 'ACCEPT'
                    ? `You are confirming your allotment in Room ${allotment?.room_no}, ${allotment?.hostel_name}. Your seat will be secured.`
                    : confirmAction === 'DECLINE'
                    ? 'Warning: If you decline, your allotted bed will be forfeited immediately and reallocated to the next eligible waitlisted applicant with matching study habit. Your application will be marked WITHDRAWN.'
                    : 'Warning: Withdrawing your application will permanently remove you from the active allotment and waitlist for this cycle.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                disabled={submitting}
                onClick={() => setConfirmAction(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F8FAFC]"
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
                className={`px-4 py-1.5 text-xs font-semibold rounded text-white shadow-sm flex items-center gap-1.5 ${
                  confirmAction === 'ACCEPT'
                    ? 'bg-[#059669] hover:bg-[#047857]'
                    : 'bg-[#DC2626] hover:bg-[#B91C1C]'
                }`}
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />}
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
