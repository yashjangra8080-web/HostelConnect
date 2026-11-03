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
    // Base styles: Neo-Brutalist 2px black border, 8px radius, font-heading font-bold, press easing
    const baseStyles =
      'inline-flex items-center justify-center font-heading font-bold select-none border-2 border-black rounded-[8px] transition-[transform,box-shadow,background-color] duration-150 ease-press focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:transform-none disabled:shadow-none';

    // Size variants: heights sm 32px (h-8), md 36px (h-9), lg 40px (h-10)
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'h-8 px-2.5 text-xs gap-1.5',
      md: 'h-9 px-3.5 text-sm gap-2',
      lg: 'h-10 px-4 text-base gap-2',
    };

    // Variant styles with density exception for size="sm"
    const getVariantStyles = (): string => {
      const isSm = size === 'sm';

      switch (variant) {
        case 'primary':
          return isSm
            ? 'bg-black text-white shadow-hard hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-hard-sm'
            : 'bg-black text-white shadow-hard-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-hard active:translate-x-1 active:translate-y-1 active:shadow-hard';

        case 'secondary':
        case 'outline':
          return 'bg-white text-black shadow-hard hover:bg-saffron hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm active:bg-saffron active:translate-x-[2px] active:translate-y-[2px] active:shadow-hard-sm';

        case 'saffron':
          return isSm
            ? 'bg-saffron text-black shadow-hard hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-hard-sm'
            : 'bg-saffron text-black shadow-hard-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-hard active:translate-x-1 active:translate-y-1 active:shadow-hard';

        case 'destructive':
          return isSm
            ? 'bg-status-danger-text text-white shadow-hard hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-hard-sm'
            : 'bg-status-danger-text text-white shadow-hard-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-hard active:translate-x-1 active:translate-y-1 active:shadow-hard';

        case 'subtle':
          return 'bg-transparent text-black border-2 border-black hover:bg-saffron active:bg-saffron';

        default:
          return 'bg-black text-white shadow-hard-lg';
      }
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${getVariantStyles()} ${className}`}
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
