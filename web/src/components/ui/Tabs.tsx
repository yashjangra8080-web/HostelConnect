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

  return (
    <div
      role="tablist"
      className={`inline-flex flex-wrap items-center gap-2 p-1 ${className}`}
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
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] text-xs font-heading font-bold select-none border-2 border-black transition-colors focus:outline-none ${
              isActive
                ? 'bg-black text-white shadow-hard-sm'
                : 'bg-white text-black hover:bg-saffron'
            } ${tab.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          >
            {tab.icon && <span className="shrink-0 flex items-center">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-[4px] text-[10px] tabular-nums font-bold border border-black ${
                  isActive ? 'bg-white text-black' : 'bg-paper text-black'
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
};
