import { useEffect } from "react";
import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  A2UIProvider,
  A2UIRenderer,
  basicCatalog,
  useA2UIActions,
} from "@copilotkit/a2ui-renderer";
import { tableCatalog } from "./table-catalog";
import { TablePaginationContext } from "./result-table";
import { createA2UIMessageRenderer } from "../MyA2UIMessageRenderer";

function GeneratedTableSurface({
  columns,
  rows,
  page = 1,
  patch,
}: {
  columns: string[];
  rows: unknown[];
  page?: number;
  patch?: { path: string; value: unknown };
}) {
  const { processMessages } = useA2UIActions();
  useEffect(() => {
    processMessages([
      { createSurface: { surfaceId: "generated", catalogId: basicCatalog.id } },
      {
        updateComponents: {
          surfaceId: "generated",
          components: [
            {
              id: "root",
              component: "Column",
              children: ["tableTitle", "tableHeader", "row_0", "paginationRow"],
            },
            {
              id: "tableTitle",
              component: "Text",
              text: "Result",
              variant: "h3",
            },
            { id: "tableHeader", component: "Row", children: ["header_0"] },
            { id: "header_0", component: "Text", text: "accession" },
            { id: "row_0", component: "Row", children: ["row_0_cell_0"] },
            {
              id: "row_0_cell_0",
              component: "Text",
              text: "stale static cell",
            },
            {
              id: "paginationRow",
              component: "Row",
              children: ["prevBtn", "pageInfo", "nextBtn"],
            },
            {
              id: "prevBtn",
              component: "Button",
              child: "prevText",
              action: {
                event: { name: "query_records", context: { page: 1 } },
              },
            },
            { id: "prevText", component: "Text", text: "Previous" },
            { id: "pageInfo", component: "Text", text: "Page 1" },
            {
              id: "nextBtn",
              component: "Button",
              child: "nextText",
              action: {
                event: { name: "query_records", context: { page: 2 } },
              },
            },
            { id: "nextText", component: "Text", text: "Next" },
          ],
        },
      },
    ]);
  }, [processMessages]);
  useEffect(() => {
    processMessages([
      {
        updateDataModel: {
          surfaceId: "generated",
          path: "/",
          value: {
            title: "Result",
            columns,
            rows,
            pageInfo: `Page ${page}`,
            isFirstPage: page === 1,
          },
        },
      },
    ]);
  }, [columns, rows, page, processMessages]);
  useEffect(() => {
    if (patch)
      processMessages([
        { updateDataModel: { surfaceId: "generated", ...patch } },
      ]);
  }, [patch, processMessages]);
  return <A2UIRenderer surfaceId="generated" />;
}

function Surface({ value }: { value: string }) {
  const { processMessages } = useA2UIActions();
  useEffect(() => {
    processMessages([
      {
        version: "v0.9",
        createSurface: { surfaceId: "result", catalogId: basicCatalog.id },
      },
      {
        version: "v0.9",
        updateComponents: {
          surfaceId: "result",
          components: [
            {
              id: "root",
              component: "Column",
              children: ["tableTitle", "row_0_cell_0", "nextBtn"],
            },
            {
              id: "tableTitle",
              component: "Text",
              text: "Results",
              variant: "h3",
            },
            { id: "row_0_cell_0", component: "Text", text: value },
            {
              id: "nextBtn",
              component: "Button",
              child: "nextText",
              action: {
                event: { name: "query_records", context: { page: 2 } },
              },
            },
            { id: "nextText", component: "Text", text: "Next" },
          ],
        },
      },
    ]);
  }, [processMessages, value]);
  return <A2UIRenderer surfaceId="result" />;
}

describe("structured table rendering", () => {
  it("retains the selected page on incremental updates and clamps it when the result shrinks", async () => {
    const columns = ["gene"];
    const rows = Array.from({ length: 21 }, (_, index) => ({
      gene: `PATCH-${index + 1}`,
    }));
    const View = ({
      patch,
      values = rows,
    }: {
      patch?: { path: string; value: unknown };
      values?: typeof rows;
    }) => (
      <TablePaginationContext.Provider value="local">
        <A2UIProvider catalog={tableCatalog}>
          <GeneratedTableSurface
            columns={columns}
            rows={values}
            patch={patch}
          />
        </A2UIProvider>
      </TablePaginationContext.Provider>
    );
    const { rerender } = render(<View />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("PATCH-21")).toBeInTheDocument();
    rerender(<View patch={{ path: "/rows/20/gene", value: "PATCHED-21" }} />);
    expect(screen.getByText("PATCHED-21")).toBeInTheDocument();
    expect(screen.queryByText("PATCH-1")).not.toBeInTheDocument();
    rerender(<View values={[{ gene: "Only remaining row" }]} />);
    await waitFor(() =>
      expect(screen.getByText("Only remaining row")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    rerender(<View values={[]} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled(),
    );
  });

  it("does not display inherited JavaScript properties as missing data", () => {
    const Render = createA2UIMessageRenderer({}).render;
    render(
      <Render
        activityType="a2ui-surface"
        content={{
          type: "table",
          columns: ["gene", "toString"],
          rows: [{ gene: "TP53" }],
        }}
        message={{}}
        agent={{}}
      />,
    );
    expect(
      within(screen.getByRole("table"))
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["TP53", "-"]);
  });

  it("refreshes cached values when a single cell is patched without replacing the rows array", () => {
    const columns = ["gene"];
    const rows = [{ gene: "TP53" }];
    const { rerender } = render(
      <A2UIProvider catalog={tableCatalog}>
        <GeneratedTableSurface columns={columns} rows={rows} />
      </A2UIProvider>,
    );
    expect(screen.getByText("TP53")).toBeInTheDocument();
    rerender(
      <A2UIProvider catalog={tableCatalog}>
        <GeneratedTableSurface
          columns={columns}
          rows={rows}
          patch={{ path: "/rows/0/gene", value: "BRCA1" }}
        />
      </A2UIProvider>,
    );
    expect(screen.getByText("BRCA1")).toBeInTheDocument();
    expect(screen.queryByText("TP53")).not.toBeInTheDocument();
  });

  it("uses real local pagination when no source action handler is connected", () => {
    render(
      <TablePaginationContext.Provider value="local">
        <A2UIProvider catalog={tableCatalog}>
          <GeneratedTableSurface
            columns={["id", "gene"]}
            rows={Array.from({ length: 21 }, (_, index) => ({
              id: index + 1,
              gene: `LOCAL-${index + 1}`,
            }))}
          />
        </A2UIProvider>
      </TablePaginationContext.Provider>,
    );
    expect(screen.getByText("LOCAL-1")).toBeInTheDocument();
    expect(screen.queryByText("LOCAL-21")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("LOCAL-21")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("LOCAL-1")).toBeInTheDocument();
  });

  it("renders official table values from the data model, supports data-only updates and retains source actions", () => {
    const onAction = vi.fn();
    const columns = ["accession", "definition", "title"];
    const { rerender } = render(
      <A2UIProvider catalog={tableCatalog} onAction={onAction}>
        <GeneratedTableSurface
          columns={columns}
          rows={[
            { title: "TP53", accession: "TWAS001", definition: "Association" },
          ]}
        />
      </A2UIProvider>,
    );
    const table = screen.getByRole("table");
    const cells = within(table).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "TWAS001",
      "Association",
      "TP53",
    ]);
    expect(screen.queryByText("stale static cell")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userAction: expect.objectContaining({
          name: "query_records",
          context: { page: 2 },
        }),
      }),
    );
    rerender(
      <A2UIProvider catalog={tableCatalog} onAction={onAction}>
        <GeneratedTableSurface
          columns={columns}
          rows={[
            { accession: "TWAS002", definition: "Updated", title: "BRCA1" },
          ]}
          page={2}
        />
      </A2UIProvider>,
    );
    expect(screen.getByText("TWAS002")).toBeInTheDocument();
    expect(screen.queryByText("TWAS001")).not.toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("promotes official Property/Value record lists into sortable paginated tables and keeps scalar details left aligned", () => {
    render(
      <A2UIProvider catalog={tableCatalog}>
        <GeneratedTableSurface
          columns={["Property", "Value"]}
          rows={[
            ["count", 21],
            [
              "records",
              JSON.stringify(
                Array.from({ length: 21 }, (_, index) => ({
                  id: index + 1,
                  name: `GENE-${index + 1}`,
                  active: false,
                })),
              ),
            ],
            ["source", { href: "https://example.org/data", text: "Source" }],
          ]}
        />
      </A2UIProvider>,
    );
    expect(
      screen.queryByRole("columnheader", { name: "Value" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getByText("count").closest("dl")).toHaveAttribute(
      "data-result-details",
    );
    expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
      "href",
      "https://example.org/data",
    );
    expect(screen.queryByText("GENE-21")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("GENE-21")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "id" }));
    fireEvent.click(screen.getByRole("button", { name: "id" }));
    const firstRow = within(screen.getByRole("table")).getAllByRole("row")[1];
    expect(within(firstRow).getAllByRole("cell")[0]).toHaveTextContent("21");
  });

  it("renders single-object details without hiding fields behind a five-field preview", () => {
    const Render = createA2UIMessageRenderer({}).render;
    render(
      <Render
        activityType="a2ui-surface"
        content={{
          type: "table",
          columns: ["Property", "Value"],
          rows: [
            ["Record", { a: "A", b: "B", c: "C", d: "D", e: "E", f: "F" }],
          ],
        }}
        message={{}}
        agent={{}}
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("F")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Show more/ }),
    ).not.toBeInTheDocument();
  });

  it("uses readable values in real legacy tables, retaining sorting and pagination", () => {
    const Render = createA2UIMessageRenderer({}).render;
    render(
      <Render
        activityType="a2ui-surface"
        content={{
          type: "table",
          columns: ["Record"],
          rows: Array.from({ length: 21 }, (_, i) => ({
            Record: { gene: `GENE-${i + 1}` },
          })),
        }}
        message={{ id: "legacy" }}
        agent={{}}
      />,
    );
    expect(screen.getByText("GENE-1")).toBeInTheDocument();
    expect(screen.queryByText("GENE-21")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("GENE-21")).toBeInTheDocument();
  });

  it("formats JSON in the real official A2UI renderer without replacing headings or actions", () => {
    const onAction = vi.fn();
    render(
      <A2UIProvider catalog={tableCatalog} onAction={onAction}>
        <Surface value={'{"gene":"BRCA1","count":0}'} />
      </A2UIProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Results" }),
    ).toBeInTheDocument();
    expect(screen.getByText("gene")).toBeInTheDocument();
    expect(screen.getByText("BRCA1")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userAction: expect.objectContaining({
          name: "query_records",
          context: { page: 2 },
        }),
      }),
    );
    expect(tableCatalog.components.get("Text")).not.toBe(
      basicCatalog.components.get("Text"),
    );
    expect(tableCatalog.components.get("Button")).toBe(
      basicCatalog.components.get("Button"),
    );
  });
});
