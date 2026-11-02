import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'subtle' | 'saffron';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Base styles: crisp, hairline borders, no shadows, no gradients
    const baseStyles =
      'inline-flex items-center justify-center font-sans font-medium select-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

    // Size variants: dense, institutional heights
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'h-8 px-2.5 text-xs gap-1.5 rounded',
      md: 'h-9 px-3.5 text-sm gap-2 rounded',
      lg: 'h-10 px-4 text-base gap-2 rounded-md',
    };

    // Variant styles using our strict semantic tokens
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-primary text-ink-onDark hover:bg-primary-hover active:bg-primary-hover focus:ring-primary border border-transparent',
      secondary:
        'bg-surface-subtle text-ink-primary hover:bg-surface border border-border hover:border-border-strong active:bg-surface-muted focus:ring-primary',
      outline:
        'bg-surface text-ink-primary hover:bg-surface-subtle border border-border hover:border-border-strong active:bg-surface-muted focus:ring-primary',
      destructive:
        'bg-status-danger-text text-ink-onDark hover:opacity-95 active:opacity-90 focus:ring-status-danger-text border border-transparent',
      subtle:
        'bg-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle active:bg-surface-muted focus:ring-primary border border-transparent',
      saffron:
        'bg-saffron text-ink-onDark hover:bg-saffron-hover active:bg-saffron-hover focus:ring-saffron border border-transparent',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" strokeWidth={1.75} />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
