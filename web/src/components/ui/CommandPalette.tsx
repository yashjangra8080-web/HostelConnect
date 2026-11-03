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
        return <User className="w-4 h-4 text-black" strokeWidth={2} />;
      case 'complaint':
        return <ShieldAlert className="w-4 h-4 text-status-warning-text" strokeWidth={2} />;
      case 'notice':
        return <Bell className="w-4 h-4 text-black" strokeWidth={2} />;
      case 'page':
      default:
        return <FileText className="w-4 h-4 text-black" strokeWidth={2} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Solid flat backdrop: rgba(0,0,0,0.6), NO blur */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 transition-opacity"
        aria-hidden="true"
      />

      {/* Palette Container: white, border-2 border-black, shadow-hard-lg, 4px radius */}
      <div
        role="dialog"
        aria-modal="true"
        onKeyDown={handleKeyDown}
        className="relative z-10 w-full max-w-xl bg-white border-2 border-black rounded-[4px] shadow-hard-lg overflow-hidden flex flex-col"
      >
        {/* Search Input Bar */}
        <div className="px-4 py-3 border-b-2 border-black flex items-center gap-3 bg-white">
          <Search className="w-4 h-4 text-black shrink-0" strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students, roll numbers, pages, or records..."
            className="w-full text-base sm:text-sm text-black placeholder:text-ink-light bg-transparent focus:outline-none"
          />
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-black animate-spin shrink-0" strokeWidth={2} />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-black hover:text-status-danger-text p-0.5"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] bg-white border-2 border-black text-black font-bold">
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-black/20">
          {!query.trim() ? (
            <div className="py-8 text-center text-xs text-black font-medium">
              <p>Type to search across HostelConnect records and navigation.</p>
              <p className="mt-1 text-[11px] text-ink-muted">
                Staff: search student names or roll numbers. Students: search pages and grievances.
              </p>
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div className="py-8 text-center text-xs text-black font-medium">
              No matching results found for &ldquo;<span className="font-bold text-black">{query}</span>&rdquo;
            </div>
          ) : (
            results.map((res, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${res.type}-${res.id}-${idx}`}
                  onClick={() => handleSelect(res)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded-[4px] flex items-center justify-between cursor-pointer transition-colors border-2 ${
                    isSelected ? 'bg-saffron text-black border-black shadow-hard-sm' : 'border-transparent hover:bg-paper'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 p-1.5 rounded-[4px] bg-white border-2 border-black flex items-center justify-center">
                      {getResultIcon(res.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-heading font-bold text-black truncate">
                          {res.title}
                        </span>
                        {res.meta && (
                          <span className="text-[11px] text-black/70 truncate font-mono font-bold">
                            {res.meta}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-black/80 truncate font-medium">{res.subtitle}</p>
                    </div>
                  </div>

                  <div className="shrink-0 ml-3 flex items-center">
                    {isSelected && (
                      <span className="text-[11px] text-black flex items-center gap-1 font-bold">
                        <span>Select</span>
                        <CornerDownLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t-2 border-black bg-white flex items-center justify-between text-[11px] text-black font-bold">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border-2 border-black rounded-[4px] font-mono text-[10px]">
                ↑
              </kbd>{' '}
              <kbd className="px-1.5 py-0.5 bg-white border-2 border-black rounded-[4px] font-mono text-[10px]">
                ↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border-2 border-black rounded-[4px] font-mono text-[10px]">
                ↵
              </kbd>{' '}
              Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border-2 border-black rounded-[4px] font-mono text-[10px]">
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
