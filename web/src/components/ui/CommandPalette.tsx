import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, User, ShieldAlert, Bell, CornerDownLeft, X, Loader2 } from 'lucide-react';

export interface CommandPaletteResult {
  id: string | number;
  type: 'student' | 'page' | 'complaint' | 'notice';
  title: string;
  subtitle: string;
  meta?: string;
  url: string;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult?: (result: CommandPaletteResult) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommandPaletteResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fetch results when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { credentials: 'include', signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data) => {
          setResults(data.results || []);
          setSelectedIndex(0);
          setIsLoading(false);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setIsLoading(false);
          }
        });
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const handleSelect = (result: CommandPaletteResult) => {
    if (onSelectResult) {
      onSelectResult(result);
    } else {
      window.location.href = result.url;
    }
    onClose();
  };

  const getResultIcon = (type: CommandPaletteResult['type']) => {
    switch (type) {
      case 'student':
        return <User className="w-4 h-4 text-primary" strokeWidth={1.75} />;
      case 'complaint':
        return <ShieldAlert className="w-4 h-4 text-status-warning-text" strokeWidth={1.75} />;
      case 'notice':
        return <Bell className="w-4 h-4 text-saffron" strokeWidth={1.75} />;
      case 'page':
      default:
        return <FileText className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Solid flat backdrop (NO blur/glass) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-ink-primary/50 transition-opacity"
        aria-hidden="true"
      />

      {/* Palette Container */}
      <div
        role="dialog"
        aria-modal="true"
        onKeyDown={handleKeyDown}
        className="relative z-10 w-full max-w-xl bg-surface border border-border rounded-lg overflow-hidden flex flex-col shadow-none"
      >
        {/* Search Input Bar */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-surface">
          <Search className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.75} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students, roll numbers, pages, or records..."
            className="w-full text-sm text-ink-primary placeholder:text-ink-muted bg-transparent focus:outline-none"
          />
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" strokeWidth={1.75} />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-ink-muted hover:text-ink-primary p-0.5"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-ink-muted">
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-border/40">
          {!query.trim() ? (
            <div className="py-8 text-center text-xs text-ink-muted">
              <p>Type to search across HostelConnect records and navigation.</p>
              <p className="mt-1 text-[11px] text-ink-secondary">
                Staff: search student names or roll numbers. Students: search pages and grievances.
              </p>
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div className="py-8 text-center text-xs text-ink-muted">
              No matching results found for &ldquo;<span className="text-ink-primary">{query}</span>&rdquo;
            </div>
          ) : (
            results.map((res, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${res.type}-${res.id}-${idx}`}
                  onClick={() => handleSelect(res)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary-subtle text-primary' : 'hover:bg-surface-subtle'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 p-1 rounded bg-surface border border-border flex items-center justify-center">
                      {getResultIcon(res.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink-primary truncate">
                          {res.title}
                        </span>
                        {res.meta && (
                          <span className="text-[11px] text-ink-muted truncate font-mono">
                            {res.meta}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-secondary truncate">{res.subtitle}</p>
                    </div>
                  </div>

                  <div className="shrink-0 ml-3 flex items-center">
                    {isSelected && (
                      <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                        <span>Select</span>
                        <CornerDownLeft className="w-3 h-3" strokeWidth={2} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-border bg-surface-subtle flex items-center justify-between text-[11px] text-ink-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-border rounded font-mono text-[10px]">
                ↑
              </kbd>{' '}
              <kbd className="px-1 py-0.5 bg-surface border border-border rounded font-mono text-[10px]">
                ↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-border rounded font-mono text-[10px]">
                ↵
              </kbd>{' '}
              Select
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-border rounded font-mono text-[10px]">
                ESC
              </kbd>{' '}
              Close
            </span>
          </div>
          <span className="font-mono">Max 8 results</span>
        </div>
      </div>
    </div>
  );
};
