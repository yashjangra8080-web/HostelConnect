import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  RowSelectionState,
  OnChangeFn,
} from '@tanstack/react-table';
import { ArrowUp, ArrowDown, ArrowUpDown, Loader2 } from 'lucide-react';
import { Checkbox } from './Checkbox.js';

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData, index: number) => string;
}

export function DataTable<TData>({
  data,
  columns,
  enableRowSelection = false,
  rowSelection = {},
  onRowSelectionChange,
  sorting = [],
  onSortingChange,
  isLoading = false,
  emptyMessage = 'No records found.',
  onRowClick,
  getRowId,
}: DataTableProps<TData>) {
  // Add selection column if enabled
  const tableColumns = React.useMemo(() => {
    if (!enableRowSelection) return columns;

    const selectCol: ColumnDef<TData, any> = {
      id: '__select',
      header: ({ table }) => (
        <div className="flex items-center justify-center pl-1">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Select all rows"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center pl-1">
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            aria-label="Select row"
          />
        </div>
      ),
      size: 40,
    };

    return [selectCol, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange,
    onRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableRowSelection,
    getRowId,
  });

  return (
    <div className="w-full bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
      <div className="relative overflow-x-auto max-h-[600px]">
        <table className="w-full border-collapse text-left text-sm font-sans">
          {/* Sticky Header */}
          <thead className="sticky top-0 z-10 bg-surface-subtle border-b border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="h-10">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      className="px-4 text-xs font-semibold uppercase tracking-wider text-ink-secondary select-none"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="group inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-ink-secondary hover:text-ink-primary focus:outline-none focus:text-primary"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="shrink-0 flex items-center">
                            {sortDir === 'asc' ? (
                              <ArrowUp className="w-4 h-4 text-primary" strokeWidth={1.75} />
                            ) : sortDir === 'desc' ? (
                              <ArrowDown className="w-4 h-4 text-primary" strokeWidth={1.75} />
                            ) : (
                              <ArrowUpDown
                                className="w-3.5 h-3.5 text-ink-muted opacity-60 group-hover:opacity-100"
                                strokeWidth={1.75}
                              />
                            )}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border bg-surface">
            {isLoading ? (
              <tr>
                <td colSpan={tableColumns.length} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-ink-muted">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" strokeWidth={1.75} />
                    <span className="text-xs">Loading records...</span>
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={tableColumns.length} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center gap-1 text-ink-muted">
                    <p className="text-sm font-medium text-ink-secondary">{emptyMessage}</p>
                    <p className="text-xs text-ink-muted">Try adjusting search filters or parameters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => onRowClick && onRowClick(row.original)}
                  className={`h-11 transition-colors duration-100 focus:outline-none focus:bg-primary-subtle/50 ${
                    row.getIsSelected()
                      ? 'bg-primary-subtle/40'
                      : 'hover:bg-primary-subtle/20'
                  } ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 text-ink-primary whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
