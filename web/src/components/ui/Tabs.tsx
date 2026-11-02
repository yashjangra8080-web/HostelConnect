import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'line' | 'pill';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'line',
  className = '',
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === 'ArrowRight') {
      const nextIndex = (currentIndex + 1) % tabs.length;
      if (!tabs[nextIndex].disabled) onChange(tabs[nextIndex].id);
    } else if (e.key === 'ArrowLeft') {
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      if (!tabs[prevIndex].disabled) onChange(tabs[prevIndex].id);
    }
  };

  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        className={`inline-flex items-center gap-1 p-1 bg-surface-subtle border border-border rounded-md ${className}`}
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors select-none focus:outline-none focus:ring-1 focus:ring-primary ${
                isActive
                  ? 'bg-surface text-ink-primary font-semibold border border-border'
                  : 'text-ink-secondary hover:text-ink-primary hover:bg-surface/50 border border-transparent'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {tab.icon && <span className="shrink-0 flex items-center">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-semibold ${
                    isActive ? 'bg-primary-subtle text-primary' : 'bg-surface border border-border text-ink-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`w-full border-b border-border ${className}`}>
      <nav role="tablist" className="-mb-px flex space-x-6 overflow-x-auto">
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`inline-flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors select-none whitespace-nowrap focus:outline-none ${
                isActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-border-strong'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {tab.icon && <span className="shrink-0 flex items-center">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded text-[11px] tabular-nums font-semibold border ${
                    isActive
                      ? 'bg-primary-subtle border-primary-border text-primary'
                      : 'bg-surface-subtle border-border text-ink-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
