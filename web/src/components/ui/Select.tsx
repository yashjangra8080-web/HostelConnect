import React from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  leftIcon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      leftIcon,
      disabled = false,
      id,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label
            htmlFor={selectId}
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

          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`w-full h-9 rounded-[8px] bg-white border-2 text-base sm:text-sm text-black appearance-none transition-all duration-150 focus:outline-none focus:shadow-hard ${
              error
                ? 'border-status-danger-text focus:border-status-danger-text'
                : 'border-black hover:border-black focus:border-black'
            } ${leftIcon ? 'pl-9' : 'pl-3'} pr-9 ${
              disabled ? 'bg-surface-subtle text-black cursor-not-allowed opacity-60' : ''
            } ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
            {children}
          </select>

          <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
            {error ? (
              <AlertCircle className="w-4 h-4 text-status-danger-text" strokeWidth={1.75} />
            ) : (
              <ChevronDown className="w-4 h-4 text-black" strokeWidth={2} />
            )}
          </div>
        </div>

        {error ? (
          <p className="text-xs text-status-danger-text font-bold">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-ink-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
