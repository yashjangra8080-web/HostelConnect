import React from 'react';

export type StatusType = 'success' | 'warning' | 'danger' | 'neutral' | 'saffron' | 'primary';
export type StatusTagSize = 'sm' | 'md';

export interface StatusTagProps {
  status: StatusType;
  label: React.ReactNode;
  icon?: React.ReactNode;
  size?: StatusTagSize;
  className?: string;
}

export const StatusTag: React.FC<StatusTagProps> = ({
  status = 'neutral',
  label,
  icon,
  size = 'md',
  className = '',
}) => {
  const statusStyles: Record<StatusType, string> = {
    success: 'bg-status-success-bg text-status-success-text border-status-success-border',
    warning: 'bg-status-warning-bg text-status-warning-text border-status-warning-border',
    danger: 'bg-status-danger-bg text-status-danger-text border-status-danger-border',
    neutral: 'bg-status-neutral-bg text-status-neutral-text border-status-neutral-border',
    saffron: 'bg-saffron-subtle text-saffron border-saffron-border',
    primary: 'bg-primary-subtle text-primary border-primary-border',
  };

  const sizeStyles: Record<StatusTagSize, string> = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border tabular-nums select-none tracking-tight ${statusStyles[status]} ${sizeStyles[size]} ${className}`}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span>{label}</span>
    </span>
  );
};
