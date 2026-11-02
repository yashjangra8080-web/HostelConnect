import React, { useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { Button } from './Button.js';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Solid flat backdrop (NO blur/glass) */}
      <div
        onClick={() => !isLoading && onClose()}
        className="fixed inset-0 bg-ink-primary/50 transition-opacity"
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md bg-surface border border-border rounded-lg shadow-none overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center border ${
                isDestructive
                  ? 'bg-status-danger-bg text-status-danger-text border-status-danger-border'
                  : 'bg-primary-subtle text-primary border-primary-border'
              }`}
            >
              {isDestructive ? (
                <AlertTriangle className="w-4 h-4" strokeWidth={2} />
              ) : (
                <Info className="w-4 h-4" strokeWidth={2} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-ink-primary">{title}</h3>
                <button
                  type="button"
                  onClick={() => !isLoading && onClose()}
                  aria-label="Close dialog"
                  className="text-ink-muted hover:text-ink-primary p-0.5"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
              <div className="text-xs text-ink-secondary mt-2 leading-relaxed">{description}</div>
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div className="px-6 py-3.5 bg-surface-subtle border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'primary'}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
