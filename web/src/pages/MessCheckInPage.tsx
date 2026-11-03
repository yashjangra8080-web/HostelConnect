import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { formatDateTimeIST } from '../utils/format.js';

interface MessCheckInPageProps {
  onNavigate: (path: string) => void;
}

export const MessCheckInPage: React.FC<MessCheckInPageProps> = ({ onNavigate }) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<{
    status: 'success' | 'error';
    title: string;
    message: string;
    meal?: {
      type_name: string;
      start_time: string;
      end_time: string;
      meal_date: string;
      hostel_name?: string;
    };
    student?: {
      full_name: string;
      roll_no: string;
    };
    timestamp?: string;
  } | null>(null);

  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [manualToken, setManualToken] = useState<string>('');

  // Extract ?t=... on mount and auto-submit
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('t')?.trim();
    if (tokenParam) {
      setManualToken(tokenParam);
      executeCheckIn(tokenParam);
    } else {
      setShowManualInput(true);
    }
  }, []);

  const translateErrorMessage = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes('outside') || lower.includes('window')) {
      return 'You are outside the designated meal serving window for this meal slot.';
    }
    if (lower.includes('already') || lower.includes('duplicate')) {
      return 'Your attendance has already been recorded for this meal slot.';
    }
    if (lower.includes('does not reside') || lower.includes('residence') || lower.includes('hostel')) {
      return 'You are not allotted to the hostel offering this meal. Dining is restricted to assigned hostel residents.';
    }
    if (lower.includes('invalid') || lower.includes('expired') || lower.includes('token')) {
      return 'The scanned QR code is invalid or has expired (codes rotate every 60 seconds). Please scan the current code at the counter.';
    }
    if (lower.includes('closed')) {
      return 'This meal slot is closed for scheduled maintenance or special campus catering.';
    }
    return msg || 'Failed to record attendance.';
  };

  const executeCheckIn = async (qrToken: string) => {
    if (!qrToken.trim()) return;
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/mess/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: qrToken.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errorMsg = json.message || json.error || 'Check-in failed';
        setResult({
          status: 'error',
          title: 'Attendance Not Recorded',
          message: translateErrorMessage(errorMsg),
        });
      } else {
        setResult({
          status: 'success',
          title: 'Meal Attendance Recorded',
          message: `Your check-in for ${json.meal?.type_name || 'meal'} was verified and logged.`,
          meal: json.meal,
          student: json.student,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setResult({
        status: 'error',
        title: 'Connection Error',
        message: err.message || 'Unable to connect to the hostel server. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      executeCheckIn(manualToken.trim());
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-heading font-extrabold text-black tracking-tight">
          Dining Hall Attendance
        </h1>
        <p className="text-xs text-black/70 font-sans">
          Instant contactless check-in via 60-second rotating counter QR code.
        </p>
      </div>

      {/* Submitting Loading State */}
      {submitting && (
        <div className="p-8 bg-white border-2 border-black rounded-[4px] text-center space-y-3 shadow-hard-lg">
          <RefreshCw className="w-8 h-8 text-black animate-spin mx-auto" />
          <h3 className="text-sm font-heading font-bold text-black">Verifying Counter Token...</h3>
          <p className="text-xs text-black/70 max-w-xs mx-auto font-sans">
            Checking HMAC cryptographic signature, 60-second rotation window, and hostel residence.
          </p>
        </div>
      )}

      {/* Success Card */}
      {!submitting && result?.status === 'success' && (
        <div className="p-6 bg-white border-2 border-black rounded-[4px] space-y-5 text-center shadow-hard-lg">
          <div className="w-14 h-14 rounded-full bg-status-success-bg border-2 border-black text-black flex items-center justify-center mx-auto shadow-hard-sm">
            <CheckCircle2 className="w-8 h-8 text-black" strokeWidth={2.5} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-heading font-extrabold uppercase tracking-wider text-black bg-saffron px-2.5 py-1 border-2 border-black rounded-[4px] inline-block shadow-hard-sm">
              Verified & Logged
            </span>
            <h2 className="text-2xl font-heading font-extrabold text-black tracking-tight mt-2">
              {result.meal?.type_name || 'Meal'} Recorded
            </h2>
            <p className="text-xs text-black/80 font-sans max-w-sm mx-auto">
              {result.message}
            </p>
          </div>

          {/* Details Grid */}
          <div className="p-4 bg-surface-subtle/20 border-2 border-black rounded-[4px] text-xs space-y-2 text-left font-mono">
            {result.student && (
              <div className="flex justify-between border-b border-black/20 pb-1.5">
                <span className="text-black/60 font-sans text-[11px]">Resident:</span>
                <span className="font-bold text-black">
                  {result.student.full_name} ({result.student.roll_no})
                </span>
              </div>
            )}
            {result.meal && (
              <div className="flex justify-between border-b border-black/20 pb-1.5">
                <span className="text-black/60 font-sans text-[11px]">Meal Slot:</span>
                <span className="font-semibold text-black">
                  {result.meal.type_name} ({result.meal.start_time?.slice(0, 5)} - {result.meal.end_time?.slice(0, 5)} IST)
                </span>
              </div>
            )}
            {result.meal?.hostel_name && (
              <div className="flex justify-between border-b border-black/20 pb-1.5">
                <span className="text-black/60 font-sans text-[11px]">Dining Hall:</span>
                <span className="font-semibold text-black">{result.meal.hostel_name}</span>
              </div>
            )}
            <div className="flex justify-between pt-0.5">
              <span className="text-black/60 font-sans text-[11px]">Timestamp:</span>
              <span className="font-medium text-black tabular-nums">
                {result.timestamp ? formatDateTimeIST(result.timestamp) : 'Just now'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate('/student/mess')}
              className="w-full sm:w-auto"
            >
              <span>View My Mess Attendance</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => onNavigate('/student')}
              className="w-full sm:w-auto"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* Error Card */}
      {!submitting && result?.status === 'error' && (
        <div className="p-6 bg-white border-2 border-black rounded-[4px] space-y-4 text-center shadow-hard-lg">
          <div className="w-14 h-14 rounded-full bg-status-danger-bg border-2 border-black text-black flex items-center justify-center mx-auto shadow-hard-sm">
            <AlertTriangle className="w-7 h-7 text-black" strokeWidth={2.5} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-heading font-extrabold uppercase tracking-wider text-black bg-status-danger-bg px-2.5 py-1 border-2 border-black rounded-[4px] inline-block shadow-hard-sm">
              Check-in Rejected
            </span>
            <h2 className="text-xl font-heading font-extrabold text-black tracking-tight mt-2">
              {result.title}
            </h2>
            <p className="text-xs text-black/80 font-sans max-w-sm mx-auto leading-relaxed">
              {result.message}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowManualInput(true);
                setResult(null);
              }}
            >
              Scan Again or Enter Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('/student/mess')}
            >
              Back to Mess Strip
            </Button>
          </div>
        </div>
      )}

      {/* Collapsed Manual Code Fallback */}
      <div className="bg-white border-2 border-black rounded-[4px] overflow-hidden shadow-hard">
        <button
          type="button"
          onClick={() => setShowManualInput((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-heading font-bold text-black hover:bg-paper transition-colors text-left"
        >
          <span className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-black" strokeWidth={2} />
            <span>Enter code manually</span>
          </span>
          {showManualInput ? (
            <ChevronUp className="w-4 h-4 text-black" strokeWidth={2} />
          ) : (
            <ChevronDown className="w-4 h-4 text-black" strokeWidth={2} />
          )}
        </button>

        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="p-4 pt-3 border-t-2 border-black space-y-3 bg-surface-subtle/20">
            <p className="text-[11px] text-black/70 font-sans">
              If your phone camera cannot scan the QR code, paste the 64-character token displayed below the counter screen.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Paste 64-char QR token..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="font-mono text-xs flex-1"
                disabled={submitting}
              />
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !manualToken.trim()}
              >
                Submit
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
