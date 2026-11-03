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
      className={`w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(
        items.length,
        4
      )} gap-4 ${className}`}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="p-4 bg-white border-2 border-black rounded-[4px] shadow-hard flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-heading font-bold tracking-wider uppercase text-[11px] sm:text-xs text-black">
              {item.label}
            </span>
            {item.icon && (
              <div className="w-8 h-8 rounded-[4px] border-2 border-black bg-paper flex items-center justify-center text-black shrink-0">
                {item.icon}
              </div>
            )}
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-black tabular-nums">
              {item.value}
            </span>
            {item.badge && <div className="shrink-0">{item.badge}</div>}
          </div>

          {item.subtext && (
            <p className="text-[11px] text-black/70 font-medium mt-1.5 leading-snug">{item.subtext}</p>
          )}
        </div>
      ))}
    </div>
  );
};
