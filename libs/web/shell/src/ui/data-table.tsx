import type { PaginatedResponse } from '@erp/shared-contracts';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { cn } from './cn';
import { EmptyState } from './empty-state';

export interface DataTableProps<TRow> {
  columns: readonly ColumnDef<TRow, unknown>[];
  /** A página corrente, no formato que a API devolve (`{ items, page, pageSize, total }`). */
  page: PaginatedResponse<TRow>;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  /** Substitui o estado vazio padrão, para a lista dizer o que criar. */
  emptyState?: React.ReactNode;
  caption?: string;
  className?: string;
}

/**
 * Tabela paginada pelo servidor (CLAUDE.md §5: `?page=&pageSize=`, resposta
 * `{ items, page, pageSize, total }`). A tabela não fatia nada: só desenha a página
 * que recebeu e avisa quando o usuário pede outra.
 */
export function DataTable<TRow>({
  columns,
  page,
  onPageChange,
  isLoading = false,
  emptyState,
  caption,
  className,
}: DataTableProps<TRow>) {
  const { t } = useTranslation();

  const table = useReactTable({
    data: page.items as TRow[],
    columns: columns as ColumnDef<TRow, unknown>[],
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(page.total / page.pageSize)),
    state: { pagination: { pageIndex: page.page - 1, pageSize: page.pageSize } },
  });

  if (!isLoading && page.total === 0) {
    return <>{emptyState ?? <EmptyState description={t('table.empty')} />}</>;
  }

  const first = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const last = Math.min(page.page * page.pageSize, page.total);
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full caption-bottom text-sm">
          <caption className="sr-only">{caption ?? t('table.caption')}</caption>
          <thead className="border-b border-border bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-3 py-2 text-left font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  {t('table.loading')}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" role="status">
          {t('table.summary', { first, last, total: page.total })}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page.page - 1)}
            disabled={page.page <= 1 || isLoading}
          >
            {t('table.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page.page + 1)}
            disabled={page.page >= lastPage || isLoading}
          >
            {t('table.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
