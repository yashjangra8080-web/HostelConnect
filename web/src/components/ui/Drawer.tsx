import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string; // default max-w-md
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-md',
}) => {
  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Solid flat backdrop (Strict: NO blur/glass) */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-ink-primary/50 transition-opacity"
      />

      {/* Right Drawer Panel with hairline left border */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${width} h-full bg-surface border-l border-border flex flex-col focus:outline-none`}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-border flex items-start justify-between bg-surface-subtle">
          <div>
            <h3 className="text-base font-semibold text-ink-primary">{title}</h3>
            {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="text-ink-muted hover:text-ink-primary p-1 rounded hover:bg-surface border border-transparent hover:border-border transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">{children}</div>

        {/* Drawer Footer */}
        {footer && (
          <div className="px-6 py-3.5 border-t border-border bg-surface-subtle flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
