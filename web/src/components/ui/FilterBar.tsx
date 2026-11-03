import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { Button } from './Button.js';

export interface FilterChip {
  key: string;
  label: string;
  value: string;
  displayValue?: string;
}

export interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeChips: FilterChip[];
  onRemoveChip: (key: string) => void;
  onClearAll: () => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Hook to sync filters with browser URL search parameters
 */
export function useUrlFilters<T extends Record<string, string>>(initialValues: T) {
  const [filters, setFilters] = React.useState<T>(() => {
    if (typeof window === 'undefined') return initialValues;
    const params = new URLSearchParams(window.location.search);
    const parsed = { ...initialValues };
    for (const [key] of Object.entries(initialValues)) {
      if (params.has(key)) {
        (parsed as any)[key] = params.get(key) || '';
      }
    }
    return parsed;
  });

  const updateFilter = React.useCallback((key: keyof T, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (value) {
          url.searchParams.set(String(key), value);
        } else {
          url.searchParams.delete(String(key));
        }
        window.history.replaceState({}, '', url.toString());
      }
      return next;
    });
  }, []);

  const clearFilters = React.useCallback(() => {
    setFilters(initialValues);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      for (const key of Object.keys(initialValues)) {
        url.searchParams.delete(key);
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [initialValues]);

  return { filters, updateFilter, clearFilters, setFilters };
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchPlaceholder = 'Filter records by keyword...',
  searchValue,
  onSearchChange,
  activeChips,
  onRemoveChip,
  onClearAll,
  children,
  className = '',
}) => {
  return (
    <div className={`w-full p-3 bg-white border-2 border-black rounded-[4px] shadow-hard space-y-2.5 ${className}`}>
      {/* Top search & filter controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-black flex items-center">
            <Search className="w-4 h-4" strokeWidth={2} />
          </div>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-8 bg-white border-2 border-black rounded-[8px] text-base sm:text-sm text-black placeholder:text-ink-light focus:outline-none focus:shadow-hard"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black hover:text-status-danger-text p-0.5"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>

        {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}

        {activeChips.length > 0 && (
          <Button
            variant="subtle"
            size="sm"
            onClick={onClearAll}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t-2 border-black">
          <span className="text-xs font-bold text-black mr-1">Active Filters:</span>
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border-2 border-black rounded-[6px] text-xs text-black font-bold"
            >
              <span className="text-black/70">{chip.label}:</span>
              <span>{chip.displayValue || chip.value}</span>
              <button
                type="button"
                onClick={() => onRemoveChip(chip.key)}
                aria-label={`Remove filter for ${chip.label}`}
                className="text-black hover:text-status-danger-text p-0.5 focus:outline-none"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
