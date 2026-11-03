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
      className={`w-full p-4 bg-white border-2 border-black rounded-[4px] shadow-hard flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-black ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-status-danger-bg border-2 border-black flex items-center justify-center shrink-0">
          <AlertCircle className="w-4 h-4 text-status-danger-text" strokeWidth={2.5} />
        </div>
        <div>
          <h4 className="text-sm font-heading font-extrabold text-status-danger-text leading-tight">{title}</h4>
          <p className="text-xs text-black font-medium mt-0.5 leading-normal">{message}</p>
        </div>
      </div>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />}
          className="shrink-0"
        >
          Retry
        </Button>
      )}
    </div>
  );
};
