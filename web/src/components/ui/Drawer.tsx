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
      {/* Solid flat backdrop: rgba(0,0,0,0.6), NO blur */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-black/60 transition-opacity"
      />

      {/* Right Drawer Panel with 2px black border and hard shadow */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${width} h-full bg-white border-l-2 border-black shadow-hard-lg flex flex-col focus:outline-none`}
      >
        {/* Drawer Header: weight 800 heading font, 2px bottom border */}
        <div className="px-6 py-4 border-b-2 border-black flex items-start justify-between bg-white">
          <div>
            <h3 className="text-base font-heading font-extrabold text-black">{title}</h3>
            {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="text-black p-1 rounded-[8px] border-2 border-black hover:bg-saffron transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">{children}</div>

        {/* Drawer Footer */}
        {footer && (
          <div className="px-6 py-3.5 border-t-2 border-black bg-white flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
