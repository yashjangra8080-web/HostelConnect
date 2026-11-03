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
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-subtle border border-border text-[11px] font-mono font-medium text-ink-secondary">
          <QrCode className="w-3.5 h-3.5 text-primary" />
          <span>MESS COUNTER CHECK-IN</span>
        </div>
        <h1 className="text-2xl font-serif font-bold text-ink-primary">
          Dining Hall Attendance
        </h1>
        <p className="text-xs text-ink-muted">
          Instant contactless check-in via 60-second rotating counter QR code.
        </p>
      </div>

      {/* Submitting Loading State */}
      {submitting && (
        <div className="p-8 bg-surface border border-border rounded-lg text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
          <h3 className="text-sm font-semibold text-ink-primary">Verifying Counter Token...</h3>
          <p className="text-xs text-ink-muted max-w-xs mx-auto">
            Checking HMAC cryptographic signature, 60-second rotation window, and hostel residence.
          </p>
        </div>
      )}

      {/* Success Card */}
      {!submitting && result?.status === 'success' && (
        <div className="p-6 bg-surface border-2 border-emerald-500/50 rounded-lg space-y-5 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" strokeWidth={2.25} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Verified & Logged
            </span>
            <h2 className="text-2xl font-serif font-bold text-ink-primary">
              {result.meal?.type_name || 'Meal'} Recorded
            </h2>
            <p className="text-xs text-ink-secondary max-w-sm mx-auto">
              {result.message}
            </p>
          </div>

          {/* Details Grid */}
          <div className="p-4 bg-surface-subtle border border-border rounded text-xs space-y-2 text-left font-mono">
            {result.student && (
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-ink-muted font-sans text-[11px]">Resident:</span>
                <span className="font-semibold text-ink-primary">
                  {result.student.full_name} ({result.student.roll_no})
                </span>
              </div>
            )}
            {result.meal && (
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-ink-muted font-sans text-[11px]">Meal Slot:</span>
                <span className="font-medium text-ink-primary">
                  {result.meal.type_name} ({result.meal.start_time?.slice(0, 5)} - {result.meal.end_time?.slice(0, 5)} IST)
                </span>
              </div>
            )}
            {result.meal?.hostel_name && (
              <div className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-ink-muted font-sans text-[11px]">Dining Hall:</span>
                <span className="font-medium text-ink-primary">{result.meal.hostel_name}</span>
              </div>
            )}
            <div className="flex justify-between pt-0.5">
              <span className="text-ink-muted font-sans text-[11px]">Timestamp:</span>
              <span className="font-medium text-ink-secondary tabular-nums">
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
        <div className="p-6 bg-surface border-2 border-danger/40 rounded-lg space-y-4 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-danger-subtle border border-danger/30 text-danger flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" strokeWidth={2} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-danger">
              Check-in Rejected
            </span>
            <h2 className="text-xl font-serif font-bold text-ink-primary">
              {result.title}
            </h2>
            <p className="text-xs text-ink-secondary max-w-sm mx-auto leading-relaxed">
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
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowManualInput((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-ink-secondary hover:bg-surface-subtle transition-colors text-left"
        >
          <span className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-ink-muted" />
            <span>Enter code manually</span>
          </span>
          {showManualInput ? (
            <ChevronUp className="w-4 h-4 text-ink-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-ink-muted" />
          )}
        </button>

        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="p-4 pt-1 border-t border-border space-y-3 bg-surface-subtle">
            <p className="text-[11px] text-ink-muted">
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
