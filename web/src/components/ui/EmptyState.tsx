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
      className={`w-full py-12 px-6 bg-white border-2 border-black rounded-[4px] shadow-hard flex flex-col items-center justify-center text-center ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-paper border-2 border-black flex items-center justify-center text-black mb-3">
        {icon || <Inbox className="w-5 h-5 text-black" strokeWidth={2} />}
      </div>

      <h3 className="text-base font-heading font-extrabold text-black">{title}</h3>
      {description && (
        <p className="text-xs text-black font-medium max-w-sm mt-1 mb-4 leading-relaxed">
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
