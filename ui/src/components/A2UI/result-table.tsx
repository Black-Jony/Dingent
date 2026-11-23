"use client";

import { createContext, useMemo, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable } from "./data-table";
import { TableCellValue } from "./table-cell-value";
import {
  isPropertyTable,
  normalizeTableData,
  propertyTableSections,
  type ResultTableData,
  type TableRecord,
} from "./table-data";

export const TablePaginationContext = createContext<"local" | "source">(
  "source",
);

function RecordTable({
  data,
  footer,
}: {
  data: ReturnType<typeof normalizeTableData>;
  footer?: ReactNode;
}) {
  const columns = useMemo<ColumnDef<TableRecord>[]>(
    () =>
      data.columns.map((name) => ({
        id: name,
        accessorFn: (row) => (Object.hasOwn(row, name) ? row[name] : undefined),
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ms-3 h-8 max-w-full"
          >
            <span className="whitespace-normal text-start">{name}</span>
            <ArrowUpDown
              aria-hidden="true"
              className="ms-2 size-3.5 shrink-0"
            />
          </Button>
        ),
        cell: ({ getValue }) => <TableCellValue value={getValue()} />,
      })),
    [data.columns],
  );
  return <DataTable columns={columns} data={data.rows} footer={footer} />;
}

export function ResultTable({
  data,
  footer,
  revision,
}: {
  data: ResultTableData;
  footer?: ReactNode;
  revision?: number;
}) {
  const t = useTranslations("Renderer");
  const { columns, rows, title } = data;
  const normalized = useMemo(
    () => normalizeTableData({ columns, rows, title }),
    [columns, rows, title, revision],
  );
  const properties = isPropertyTable(normalized.columns);
  const sections = useMemo(
    () => (properties ? propertyTableSections(normalized) : []),
    [normalized, properties],
  );
  if (!normalized.columns.length)
    return (
      <div className="p-4 text-sm text-muted-foreground">{t("noColumns")}</div>
    );
  return (
    <div data-result-table className="my-2 min-w-0 space-y-3">
      {data.title && (
        <h3 className="text-base font-semibold [overflow-wrap:anywhere]">
          {data.title}
        </h3>
      )}
      {properties && sections.length ? (
        sections.map((section, index) => (
          <section key={index} className="min-w-0 space-y-2">
            {section.title && (
              <h4 className="text-sm font-medium [overflow-wrap:anywhere]">
                {section.title}
              </h4>
            )}
            {section.kind === "records" ? (
              <RecordTable data={section.data} />
            ) : (
              <dl
                data-result-details
                className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-2 text-sm sm:grid-cols-[minmax(7rem,12rem)_minmax(0,1fr)]"
              >
                {section.entries.map(([name, value], fieldIndex) => (
                  <div key={fieldIndex} className="contents">
                    <dt className="text-muted-foreground [overflow-wrap:anywhere]">
                      {name}
                    </dt>
                    <dd className="min-w-0 pb-1">
                      <TableCellValue value={value} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))
      ) : (
        <RecordTable data={normalized} footer={footer} />
      )}
    </div>
  );
}
