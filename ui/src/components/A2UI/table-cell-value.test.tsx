import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableCellValue } from "./table-cell-value";

describe("TableCellValue", () => {
  it("displays nested objects and JSON strings as readable fields", () => {
    const { container } = render(
      <TableCellValue
        value={JSON.stringify({
          gene: "BRCA1",
          record: { Chr: "17", clinical: ["uncertain", "reviewed"] },
        })}
      />,
    );
    for (const value of [
      "gene",
      "BRCA1",
      "record",
      "Chr",
      "17",
      "clinical",
      "uncertain",
      "reviewed",
    ]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(container.textContent).not.toContain('{"');
    expect(container.querySelector("dl")).toBeInTheDocument();
    expect(container.querySelector("ol")).toBeInTheDocument();
  });

  it.each([0, false, true, "00123", "1.5e-12", "[not JSON]", '{"incomplete":'])(
    "preserves scalar or malformed text: %s",
    (value) => {
      render(<TableCellValue value={value} />);
      expect(screen.getByText(String(value))).toBeInTheDocument();
    },
  );

  it.each([null, undefined, [], {}])(
    "handles empty values without raw brackets",
    (value) => {
      render(<TableCellValue value={value} />);
      expect(screen.getByText("-")).toBeInTheDocument();
    },
  );

  it("keeps safe object and markdown links, including within nested arrays", () => {
    render(
      <TableCellValue
        value={[
          { text: "Gene", href: "https://example.org/gene" },
          "See [Source](https://example.org/source)",
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Gene" })).toHaveAttribute(
      "href",
      "https://example.org/gene",
    );
    expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });

  it("treats unsafe links and HTML as text, not executable content", () => {
    const { container } = render(
      <TableCellValue
        value={[
          { text: "unsafe", href: "javascript:alert(1)" },
          '<img src=x onerror="alert(1)">',
        ]}
      />,
    );
    expect(screen.getByText("unsafe")).toBeInTheDocument();
    expect(container.querySelector("a, img, script")).toBeNull();
  });

  it("previews large arrays and progressively reveals every item", () => {
    render(
      <TableCellValue
        value={Array.from({ length: 30 }, (_, i) => `record-${i + 1}`)}
      />,
    );
    expect(screen.getByText("record-5")).toBeInTheDocument();
    expect(screen.queryByText("record-6")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    expect(screen.getByText("record-25")).toBeInTheDocument();
    expect(screen.queryByText("record-26")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    expect(screen.getByText("record-30")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show less/ }));
    expect(screen.queryByText("record-6")).not.toBeInTheDocument();
  });

  it("lazily renders deep structures without losing their contents", () => {
    render(
      <TableCellValue value={{ a: { b: { c: { result: "deep value" } } } }} />,
    );
    expect(screen.queryByText("deep value")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText("deep value")).toBeInTheDocument();
  });

  it("does not crash on circular objects", () => {
    const value: Record<string, unknown> = { name: "circular" };
    value.self = value;
    render(<TableCellValue value={value} />);
    expect(screen.getByText("circular")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
