import React, { useEffect, useRef } from 'react';
import { Check, Minus } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  helperText?: string;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      helperText,
      checked = false,
      indeterminate = false,
      disabled = false,
      onChange,
      id,
      className = '',
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const combinedRef = (node: HTMLInputElement | null) => {
      (internalRef as any).current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as any).current = node;
      }
    };

    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const isCheckedOrIndeterminate = checked || indeterminate;

    return (
      <div className={`inline-flex items-start gap-2.5 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${className}`}>
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={combinedRef}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="sr-only"
            {...props}
          />
          <div
            onClick={(e) => {
              if (disabled) return;
              e.preventDefault();
              internalRef.current?.click();
            }}
            className={`w-4 h-4 rounded-[4px] border-2 border-black transition-colors flex items-center justify-center ${
              isCheckedOrIndeterminate
                ? 'bg-black text-white'
                : 'bg-white hover:bg-paper'
            } ${disabled ? 'bg-surface-subtle' : ''}`}
          >
            {indeterminate ? (
              <Minus className="w-3 h-3 text-white" strokeWidth={3} />
            ) : checked ? (
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            ) : null}
          </div>
        </div>

        {(label || helperText) && (
          <div
            onClick={() => {
              if (!disabled) internalRef.current?.click();
            }}
            className="select-none"
          >
            {label && (
              <label htmlFor={checkboxId} className="text-sm font-bold text-black leading-tight block cursor-pointer">
                {label}
              </label>
            )}
            {helperText && <p className="text-xs text-ink-muted leading-tight mt-0.5">{helperText}</p>}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
