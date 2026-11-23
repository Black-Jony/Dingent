import { describe, expect, it } from "vitest";
import {
  isPropertyTable,
  normalizeTableData,
  parseTableValue,
  propertyTableSections,
} from "./table-data";

describe("result table normalization", () => {
  it("retains duplicate-column positions and unnamed array cells without losing values", () => {
    const data = normalizeTableData({
      columns: ["id", "id", "gene"],
      rows: [
        ["first", "second", "TP53", false],
        { id: "third", gene: "BRCA1", count: 0 },
      ],
    });
    expect(data.columns).toEqual(["id", "id (2)", "gene", "column_4", "count"]);
    expect(data.rows[0]).toEqual({
      id: "first",
      "id (2)": "second",
      gene: "TP53",
      column_4: false,
    });
    expect(data.rows[1].count).toBe(0);
  });

  it("matches object values by column name, retains extra fields and mixed rows without mutating inputs", () => {
    const source = {
      columns: ["accession", "definition", "title"],
      rows: [
        {
          accession: "TWAS001",
          title: "TP53",
          definition: "Association",
          extra: 0,
        },
        ["TWAS002", "Another association", false],
      ],
    };
    const before = JSON.stringify(source);
    const data = normalizeTableData(source);
    expect(data.columns).toEqual(["accession", "definition", "title", "extra"]);
    expect(data.rows[0].definition).toBe("Association");
    expect(data.rows[0].extra).toBe(0);
    expect(data.rows[1].title).toBe(false);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("promotes record arrays from Property/Value cells without losing metadata or nested values", () => {
    const records = [
      { breed_id: 1, name: "First", count: 0 },
      { breed_id: 2, name: "Second", active: false, detail: { gene: "TP53" } },
    ];
    const source = {
      columns: ["Property", "Value"],
      rows: [
        ["count", 2],
        ["model_text", JSON.stringify(records)],
        ["source", "Source URL"],
      ],
    };
    expect(isPropertyTable(source.columns)).toBe(true);
    const groups = propertyTableSections(normalizeTableData(source));
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({
      kind: "fields",
      entries: [["count", 2]],
    });
    expect(groups[1]).toMatchObject({
      kind: "records",
      title: "model_text",
      data: {
        columns: ["breed_id", "name", "count", "active", "detail"],
        rows: records,
      },
    });
    expect(groups[2]).toMatchObject({
      kind: "fields",
      entries: [["source", "Source URL"]],
    });
  });

  it("keeps empty values, malformed JSON, identifiers, and safe link objects", () => {
    for (const value of [
      0,
      false,
      "00123",
      "1.2e-8",
      "[bad JSON]",
      "{'gene': 'TP53'}",
      null,
    ]) {
      expect(parseTableValue(value)).toBe(value);
    }
    const link = { href: "https://example.org", text: "Source" };
    const sections = propertyTableSections(
      normalizeTableData({
        columns: ["Property", "Value"],
        rows: [
          ["empty", {}],
          ["source", link],
          ["missing", null],
        ],
      }),
    );
    expect(sections).toEqual([
      {
        kind: "fields",
        entries: [
          ["empty", {}],
          ["source", link],
          ["missing", null],
        ],
      },
    ]);
    expect(isPropertyTable(["Property", "Value", "other"])).toBe(false);
  });
});
