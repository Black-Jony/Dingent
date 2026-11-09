"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";

const PREVIEW_SIZE = 5;

function structuredValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function TextValue({ text }: { text: string }) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index!;
    parts.push(text.slice(end, index));
    parts.push(
      <a
        key={index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {match[1]}
      </a>,
    );
    end = index + match[0].length;
  }
  return parts.length ? (
    <>
      {parts}
      {text.slice(end)}
    </>
  ) : (
    <>{text}</>
  );
}

function ValuePreview({
  entries,
  renderEntry,
  ordered = false,
}: {
  entries: [string, unknown][];
  renderEntry: (entry: [string, unknown]) => ReactNode;
  ordered?: boolean;
}) {
  const t = useTranslations("Renderer");
  const [limit, setLimit] = useState(PREVIEW_SIZE);
  const visible = entries.slice(0, limit);
  const hasMore = entries.length > limit;
  return (
    <div className="space-y-2">
      {ordered ? (
        <ol className="list-decimal space-y-2 ps-4">
          {visible.map((entry) => (
            <li key={entry[0]}>{renderEntry(entry)}</li>
          ))}
        </ol>
      ) : (
        <dl className="space-y-1.5">
          {visible.map((entry) => (
            <div
              key={entry[0]}
              className="grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)]"
            >
              <dt className="text-muted-foreground">{entry[0]}</dt>
              <dd className="min-w-0">{renderEntry(entry)}</dd>
            </div>
          ))}
        </dl>
      )}
      {entries.length > PREVIEW_SIZE && (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setLimit(hasMore ? limit + 20 : PREVIEW_SIZE)}
        >
          {hasMore ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )}
          {t(hasMore ? "showMore" : "showLess")}
          {hasMore && ` (+${entries.length - limit})`}
        </button>
      )}
    </div>
  );
}

function NestedValue({
  value,
  ancestors = [],
  depth = 0,
}: {
  value: unknown;
  ancestors?: object[];
  depth?: number;
}) {
  const t = useTranslations("Renderer");
  const [expanded, setExpanded] = useState(false);
  const parsed = useMemo(() => structuredValue(value), [value]);
  if (parsed == null) return <span className="text-muted-foreground">-</span>;
  if (typeof parsed !== "object") return <TextValue text={String(parsed)} />;
  if (ancestors.includes(parsed)) return <span>-</span>;

  // Keep deeply nested results out of the initial DOM; nothing is discarded.
  if (depth >= 3 && !expanded) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(true)}
      >
        <ChevronDown className="size-3" />
        {t("showMore")}
      </button>
    );
  }
  if (!Array.isArray(parsed) && "href" in parsed && "text" in parsed) {
    const href = String(parsed.href);
    const text = String(parsed.text);
    return /^https?:\/\//i.test(href) ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {text}
      </a>
    ) : (
      <span>{text}</span>
    );
  }
  const entries = Object.entries(parsed);
  if (!entries.length) return <span className="text-muted-foreground">-</span>;
  return (
    <ValuePreview
      entries={entries}
      ordered={Array.isArray(parsed)}
      renderEntry={([, item]) => (
        <NestedValue
          value={item}
          ancestors={[...ancestors, parsed]}
          depth={depth >= 3 ? 1 : depth + 1}
        />
      )}
    />
  );
}

export function TableCellValue({ value }: { value: unknown }) {
  return (
    <div className="min-w-0 max-w-lg whitespace-normal font-normal [overflow-wrap:anywhere]">
      <NestedValue value={value} />
    </div>
  );
}
