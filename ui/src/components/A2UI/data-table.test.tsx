import { fireEvent, render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table";

interface TestRow {
  name: string;
}

const columns: ColumnDef<TestRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
];

const data = Array.from({ length: 25 }, (_, index) => ({
  name: `row-${index + 1}`,
}));

describe("DataTable", () => {
  it("uses 20 rows by default and supports the configured page sizes", () => {
    render(<DataTable columns={columns} data={data} />);

    expect(screen.getByText("row-20")).toBeInTheDocument();
    expect(screen.queryByText("row-21")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
      target: { value: "40" },
    });

    expect(screen.getByText("row-25")).toBeInTheDocument();
  });
});
