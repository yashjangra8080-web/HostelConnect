import React, { useState } from 'react';
import { KeyRound, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';

interface ChangePasswordPageProps {
  onSuccess: () => void;
}

export const ChangePasswordPage: React.FC<ChangePasswordPageProps> = ({ onSuccess }) => {
  const { user, csrfToken, updateMustChangePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update password.');
      }

      setSuccess('Password updated successfully! Redirecting...');
      updateMustChangePassword(false);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Password update failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const isForced = Boolean(user?.mustChangePassword);

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center items-center py-12 px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-lg p-8 shadow-none">
        {/* Header with Key Icon */}
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-saffron-subtle border border-saffron-border text-saffron flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink-primary">
              {isForced ? 'Mandatory Password Update' : 'Change Account Password'}
            </h2>
            <p className="text-xs text-ink-muted">
              {isForced
                ? 'Your account requires an immediate password update.'
                : 'Update your login password securely.'}
            </p>
          </div>
        </div>

        {/* Mandatory change notification */}
        {isForced && (
          <div
            role="alert"
            className="mb-5 p-3 rounded bg-status-warning-bg/60 border border-status-warning-border flex items-start gap-2.5 text-xs text-status-warning-text"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <p className="font-semibold leading-tight">First-time or reset credential detected</p>
              <p className="mt-0.5 text-ink-secondary leading-normal">
                To protect institutional records, you must choose a new private password before accessing the platform.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 p-3 rounded bg-status-danger-bg/50 border border-status-danger-border text-xs text-status-danger-text font-medium"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 p-3 rounded bg-status-success-bg/50 border border-status-success-border flex items-center gap-2 text-xs text-status-success-text font-medium"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            leftIcon={<Lock className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />}
            disabled={isLoading}
            required
            autoFocus
          />

          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            helperText="Must be at least 8 characters long."
            leftIcon={<Lock className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />}
            disabled={isLoading}
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-type new password"
            leftIcon={<Lock className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />}
            disabled={isLoading}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            className="w-full mt-2"
          >
            Save New Password
          </Button>
        </form>
      </div>
    </div>
  );
};
