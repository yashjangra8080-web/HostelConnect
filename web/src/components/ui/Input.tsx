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
            className="block text-xs font-bold text-black tracking-tight"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-black">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full h-9 rounded-[8px] bg-white border-2 text-base sm:text-sm text-black placeholder:text-ink-light transition-all duration-150 focus:outline-none focus:shadow-hard ${
              error
                ? 'border-status-danger-text focus:border-status-danger-text'
                : 'border-black hover:border-black focus:border-black'
            } ${leftIcon ? 'pl-9' : 'pl-3'} ${
              rightIcon || isLoading || error ? 'pr-9' : 'pr-3'
            } ${disabled ? 'bg-surface-subtle text-black cursor-not-allowed opacity-60' : ''} ${
              tabularNums ? 'tabular-nums' : ''
            } ${className}`}
            {...props}
          />

          <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
            {isLoading && (
              <Loader2 className="w-4 h-4 text-black animate-spin" strokeWidth={1.75} />
            )}
            {!isLoading && error && (
              <AlertCircle className="w-4 h-4 text-status-danger-text" strokeWidth={1.75} />
            )}
            {!isLoading && !error && rightIcon && (
              <span className="text-black flex items-center">{rightIcon}</span>
            )}
          </div>
        </div>

        {error ? (
          <p className="text-xs text-status-danger-text font-bold flex items-center gap-1">
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
