import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './Button.js';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const delta = 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (page + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  return (
    <div
      className={`w-full flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t-2 border-black text-xs text-black font-medium ${className}`}
    >
      {/* Total & Current Range */}
      <div className="flex items-center gap-3">
        <span>
          Showing{' '}
          <strong className="font-bold text-black tabular-nums">{startRecord}</strong>{' '}
          to{' '}
          <strong className="font-bold text-black tabular-nums">{endRecord}</strong> of{' '}
          <strong className="font-bold text-black tabular-nums">{total}</strong> entries
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l-2 border-black">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-7 px-2 bg-white border-2 border-black rounded-[8px] text-xs text-black font-bold focus:outline-none focus:shadow-hard"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>rows</span>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label="First page"
          className="w-8 h-8 p-0"
        >
          <ChevronsLeft className="w-4 h-4" strokeWidth={2} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="w-8 h-8 p-0"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={2} />
        </Button>

        {/* Page number buttons */}
        <div className="hidden sm:flex items-center gap-1 px-1">
          {totalPages <= 7
            ? Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`w-8 h-8 rounded-[8px] text-xs font-bold tabular-nums border-2 border-black transition-colors ${
                    p === page
                      ? 'bg-black text-white shadow-hard-sm'
                      : 'bg-white text-black hover:bg-saffron'
                  }`}
                >
                  {p}
                </button>
              ))
            : getPageNumbers().map((item, idx) =>
                typeof item === 'number' ? (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onPageChange(item)}
                    className={`w-8 h-8 rounded-[8px] text-xs font-bold tabular-nums border-2 border-black transition-colors ${
                      item === page
                        ? 'bg-black text-white shadow-hard-sm'
                        : 'bg-white text-black hover:bg-saffron'
                    }`}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={`dots-${idx}`} className="w-5 text-center text-black font-bold">
                    {item}
                  </span>
                )
              )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="w-8 h-8 p-0"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={2} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Last page"
          className="w-8 h-8 p-0"
        >
          <ChevronsRight className="w-4 h-4" strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
};
