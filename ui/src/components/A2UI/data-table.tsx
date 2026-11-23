"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // 确保路径对应你的 shadcn 组件位置
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

const PAGE_SIZE_OPTIONS = [20, 40, 60, 100] as const;

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  footer?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  footer,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations("Renderer");
  const common = useTranslations("Common");
  // 状态：排序
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: footer ? undefined : getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    // 默认每页条数，可以在这里改
    initialState: {
      pagination: {
        pageSize: PAGE_SIZE_OPTIONS[0],
      },
    },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  React.useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(data.length / pageSize) - 1);
    if (pageIndex > lastPage) table.setPageIndex(lastPage);
  }, [data.length, pageIndex, pageSize, table]);

  return (
    <div className="min-w-0">
      <div className="min-w-0 overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className="min-w-32 text-start"
                      scope="col"
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : "none"
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="min-w-32 max-w-md align-top whitespace-normal text-start"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {common("noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 翻页控制区 */}
      {footer ?? (
        <div className="flex flex-wrap items-center justify-end gap-2 py-3">
          <span
            data-testid="table-page-info"
            className="me-auto text-xs text-muted-foreground"
          >
            {t("page", {
              current: table.getState().pagination.pageIndex + 1,
              total: Math.max(1, table.getPageCount()),
            })}
          </span>
          <select
            aria-label={t("rowsPerPage")}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={table.getState().pagination.pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {t("perPage", { size })}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t("previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </div>
  );
}
