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
      {/* Solid flat backdrop: rgba(0,0,0,0.6), NO blur */}
      <div
        onClick={() => !isLoading && onClose()}
        className="fixed inset-0 bg-black/60 transition-opacity"
        aria-hidden="true"
      />

      {/* Dialog card: white, border-2 border-black, shadow-hard-lg, 4px radius */}
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md bg-white border-2 border-black rounded-[4px] shadow-hard-lg overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center border-2 border-black ${
                isDestructive
                  ? 'bg-status-danger-bg text-status-danger-text'
                  : 'bg-paper text-black'
              }`}
            >
              {isDestructive ? (
                <AlertTriangle className="w-4 h-4 text-status-danger-text" strokeWidth={2.5} />
              ) : (
                <Info className="w-4 h-4 text-black" strokeWidth={2.5} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-heading font-extrabold text-black">{title}</h3>
                <button
                  type="button"
                  onClick={() => !isLoading && onClose()}
                  aria-label="Close dialog"
                  className="text-black p-1 rounded-[8px] border-2 border-black hover:bg-saffron transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
              <div className="text-xs text-black mt-2 leading-relaxed font-medium">{description}</div>
            </div>
          </div>
        </div>

        {/* Footer controls: 2px border top */}
        <div className="px-6 py-3.5 bg-white border-t-2 border-black flex items-center justify-end gap-2">
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
