export type TableRecord = Record<string, unknown>;

export interface ResultTableData {
  title?: string;
  columns: string[];
  rows: unknown[];
}

export function parseTableValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

export function isTableRecord(value: unknown): value is TableRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeTableData(data: ResultTableData) {
  const rawColumns = data.columns.map(String);
  const objectFields = data.rows.filter(isTableRecord).flatMap(Object.keys);
  const reserved = new Set([...rawColumns, ...objectFields]);
  const columns: string[] = [];
  const appendColumn = (name: string, generated = false) => {
    let candidate = name;
    let number = 2;
    while (
      columns.includes(candidate) ||
      (reserved.has(candidate) && (generated || candidate !== name))
    ) {
      candidate = `${name} (${number++})`;
    }
    columns.push(candidate);
  };
  rawColumns.forEach((column) => appendColumn(column));
  const width = data.rows.reduce<number>(
    (maximum, row) =>
      Array.isArray(row) ? Math.max(maximum, row.length) : maximum,
    0,
  );
  while (columns.length < width)
    appendColumn(`column_${columns.length + 1}`, true);
  const rows = data.rows.map((row): TableRecord => {
    if (Array.isArray(row)) {
      return Object.fromEntries(
        columns.map((column, index) => [column, row[index]]),
      );
    }
    return isTableRecord(row) ? { ...row } : {};
  });
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return { ...data, columns, rows };
}

export function isPropertyTable(columns: string[]) {
  return (
    columns.length === 2 &&
    columns[0].toLowerCase() === "property" &&
    columns[1].toLowerCase() === "value"
  );
}

export type PropertySection =
  | {
      kind: "records";
      title: string;
      data: ReturnType<typeof normalizeTableData>;
    }
  | { kind: "fields"; title?: string; entries: [string, unknown][] };

export function propertyTableSections(
  data: ReturnType<typeof normalizeTableData>,
): PropertySection[] {
  const sections: PropertySection[] = [];
  let fields: [string, unknown][] = [];
  const flushFields = () => {
    if (fields.length) sections.push({ kind: "fields", entries: fields });
    fields = [];
  };
  for (const row of data.rows) {
    const label = String(row[data.columns[0]] ?? "");
    const value = parseTableValue(row[data.columns[1]]);
    if (Array.isArray(value) && value.length && value.every(isTableRecord)) {
      flushFields();
      sections.push({
        kind: "records",
        title: label,
        data: normalizeTableData({ columns: [], rows: value }),
      });
    } else if (
      isTableRecord(value) &&
      Object.keys(value).length > 0 &&
      !("href" in value && "text" in value)
    ) {
      flushFields();
      sections.push({
        kind: "fields",
        title: label,
        entries: Object.entries(value),
      });
    } else {
      fields.push([label, value]);
    }
  }
  flushFields();
  return sections;
}
