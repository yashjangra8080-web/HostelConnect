import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'danger' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => string;
  removeToast: (id: string) => void;
  toast: {
    success: (title: string, description?: string) => string;
    warning: (title: string, description?: string) => string;
    error: (title: string, description?: string) => string;
    info: (title: string, description?: string) => string;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type, title, description, duration = 4000 }: Omit<ToastMessage, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastMessage = { id, type, title, description, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const toastHelpers = {
    success: (title: string, description?: string) => addToast({ type: 'success', title, description }),
    warning: (title: string, description?: string) => addToast({ type: 'warning', title, description }),
    error: (title: string, description?: string) => addToast({ type: 'danger', title, description }),
    info: (title: string, description?: string) => addToast({ type: 'info', title, description }),
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast: toastHelpers }}>
      {children}
      {/* Toast viewport fixed at bottom right */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto w-full p-3.5 rounded-[4px] bg-white border-2 border-black shadow-hard flex items-start gap-3 transition-all duration-200 ${
              t.type === 'success'
                ? 'bg-status-success-bg/80 text-black'
                : t.type === 'warning'
                ? 'bg-status-warning-bg/80 text-black'
                : t.type === 'danger'
                ? 'bg-status-danger-bg/80 text-black'
                : 'bg-white text-black'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-status-success-text" strokeWidth={2.5} />
              )}
              {t.type === 'warning' && (
                <AlertTriangle className="w-4 h-4 text-status-warning-text" strokeWidth={2.5} />
              )}
              {t.type === 'danger' && (
                <AlertCircle className="w-4 h-4 text-status-danger-text" strokeWidth={2.5} />
              )}
              {t.type === 'info' && (
                <Info className="w-4 h-4 text-black" strokeWidth={2.5} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-heading font-bold text-black leading-tight">{t.title}</h4>
              {t.description && (
                <p className="text-xs text-black/80 mt-1 leading-snug font-medium">{t.description}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 text-black hover:text-status-danger-text p-0.5 rounded-[4px] focus:outline-none"
            >
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
