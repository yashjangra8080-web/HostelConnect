import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
  tabularNums?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      isLoading = false,
      tabularNums = false,
      disabled = false,
      id,
      className = '',
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-ink-secondary tracking-tight"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-ink-muted">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full h-9 rounded bg-surface border text-sm text-ink-primary placeholder:text-ink-muted transition-colors duration-150 focus:outline-none focus:ring-1 ${
              error
                ? 'border-status-danger-text focus:border-status-danger-text focus:ring-status-danger-text'
                : 'border-border hover:border-border-strong focus:border-primary focus:ring-primary'
            } ${leftIcon ? 'pl-9' : 'pl-3'} ${
              rightIcon || isLoading || error ? 'pr-9' : 'pr-3'
            } ${disabled ? 'bg-surface-subtle text-ink-muted cursor-not-allowed opacity-60' : ''} ${
              tabularNums ? 'tabular-nums' : ''
            } ${className}`}
            {...props}
          />

          <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
            {isLoading && (
              <Loader2 className="w-4 h-4 text-ink-muted animate-spin" strokeWidth={1.75} />
            )}
            {!isLoading && error && (
              <AlertCircle className="w-4 h-4 text-status-danger-text" strokeWidth={1.75} />
            )}
            {!isLoading && !error && rightIcon && (
              <span className="text-ink-muted flex items-center">{rightIcon}</span>
            )}
          </div>
        </div>

        {error ? (
          <p className="text-xs text-status-danger-text font-medium flex items-center gap-1">
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-ink-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
