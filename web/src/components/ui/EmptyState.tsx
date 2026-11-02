import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button.js';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`w-full py-12 px-6 bg-surface border border-border rounded-lg flex flex-col items-center justify-center text-center ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-ink-muted mb-3">
        {icon || <Inbox className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />}
      </div>

      <h3 className="text-base font-semibold text-ink-primary">{title}</h3>
      {description && (
        <p className="text-xs text-ink-secondary max-w-sm mt-1 mb-4 leading-relaxed">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
