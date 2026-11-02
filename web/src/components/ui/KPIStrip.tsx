import React from 'react';

export interface KPIItem {
  id: string;
  label: string;
  value: string | number;
  subtext?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

export interface KPIStripProps {
  items: KPIItem[];
  className?: string;
}

export const KPIStrip: React.FC<KPIStripProps> = ({ items, className = '' }) => {
  return (
    <div
      className={`w-full bg-surface border border-border rounded-lg overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(
        items.length,
        6
      )} divide-y sm:divide-y-0 sm:divide-x divide-border ${className}`}
    >
      {items.map((item) => (
        <div key={item.id} className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
            <span className="font-medium tracking-tight uppercase text-[11px] text-ink-secondary">
              {item.label}
            </span>
            {item.icon && <span className="text-ink-muted flex items-center">{item.icon}</span>}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-ink-primary tabular-nums">
              {item.value}
            </span>
            {item.badge && <div className="shrink-0">{item.badge}</div>}
          </div>

          {item.subtext && (
            <p className="text-[11px] text-ink-muted mt-1 leading-none">{item.subtext}</p>
          )}
        </div>
      ))}
    </div>
  );
};
