import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button.js';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`w-full p-4 bg-status-danger-bg/40 border border-status-danger-border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-ink-primary ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <AlertCircle className="w-4 h-4 text-status-danger-text" strokeWidth={2} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-status-danger-text leading-tight">{title}</h4>
          <p className="text-xs text-ink-secondary mt-0.5 leading-normal">{message}</p>
        </div>
      </div>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />}
          className="shrink-0 border-status-danger-border hover:bg-surface text-ink-primary"
        >
          Retry
        </Button>
      )}
    </div>
  );
};
