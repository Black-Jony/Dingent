import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  A2UIProvider,
  A2UIRenderer,
  basicCatalog,
  useA2UIActions,
} from "@copilotkit/a2ui-renderer";
import { tableCatalog } from "./table-catalog";
import { createA2UIMessageRenderer } from "../MyA2UIMessageRenderer";

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
