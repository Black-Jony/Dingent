import type { Message } from "@ag-ui/core";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : undefined;
}

function cell(value: unknown): string {
  if (value == null) return "-";
  const link = record(value);
  if (link && "text" in link && "href" in link) {
    return `[${String(link.text)}](${String(link.href)})`;
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function table(value: RecordValue): string {
  if (!Array.isArray(value.columns) || !Array.isArray(value.rows)) return "";
  const columns = value.columns.map(String);
  if (!columns.length) return "";
  const escape = (value: unknown) =>
    cell(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
  return [
    typeof value.title === "string" ? value.title : "",
    `| ${columns.map(escape).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...value.rows.map(
      (row) =>
        `| ${columns
          .map((column, index) =>
            escape(Array.isArray(row) ? row[index] : record(row)?.[column]),
          )
          .join(" | ")} |`,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

export function answerText(content: string): string {
  return content.replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/g, "").trim();
}

// Use the message list, not the DOM: expanded results live in a separate portal.
export function buildAnswerCopyText(messages: readonly Message[]): string {
  const parts: Array<string | { surfaceId: string }> = [];
  const surfaces = new Map<string, RecordValue>();
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const content = record(value);
    if (!content) return;
    if (Array.isArray(content.a2ui_operations)) {
      for (const operation of content.a2ui_operations) {
        const op = record(operation);
        const update = record(op?.updateDataModel);
        if (!update || typeof update.surfaceId !== "string") continue;
        const id = update.surfaceId;
        if (!surfaces.has(id)) parts.push({ surfaceId: id });
        const previous = surfaces.get(id) ?? {};
        if (!update.path || update.path === "/") {
          surfaces.set(id, { ...previous, ...record(update.value) });
        } else if (
          ["/title", "/columns", "/rows"].includes(String(update.path))
        ) {
          surfaces.set(id, {
            ...previous,
            [String(update.path).slice(1)]: update.value,
          });
        }
      }
      return;
    }
    if (Array.isArray(content.columns) && Array.isArray(content.rows)) {
      parts.push(table(content));
      return;
    }
    if (content.type === "markdown" && typeof content.content === "string") {
      parts.push(
        [content.title, content.content]
          .filter((item) => typeof item === "string")
          .join("\n\n"),
      );
      return;
    }
    const summary = record(content.summary);
    const overview = record(
      record(content.species_overview)?.association_table,
    );
    const result = record(content.association_table);
    const mode = summary?.mode ?? record(content.data)?.mode;
    const title = summary?.trait_name ?? content.title;
    if (
      overview ||
      result ||
      "sankey_image_base64" in content ||
      "text" in content
    ) {
      if (!content.sankey_image_base64 && !result && !overview) {
        if (typeof title === "string") parts.push(title);
        if (content.text != null) parts.push(String(content.text));
        return;
      }
      if (mode !== "trait" && overview) parts.push(table(overview));
      if (content.sankey_image_base64 && typeof title === "string")
        parts.push(title);
      if (result) parts.push(table(result));
    }
  };
  for (const message of messages) {
    if (
      message.role === "assistant" &&
      !message.id.startsWith("dingent-run-progress-")
    ) {
      parts.push(answerText(message.content ?? ""));
    } else if (
      message.role === "activity" &&
      message.activityType === "a2ui-surface"
    ) {
      collect(message.content);
    }
  }
  return parts
    .map((part) =>
      typeof part === "string"
        ? part
        : table(surfaces.get(part.surfaceId) ?? {}),
    )
    .filter((part) => part.trim())
    .join("\n\n");
}

export function getAnswerCopyTargets(
  messages: readonly Message[],
  isRunning: boolean,
): Map<string, Message[]> {
  const turns: Message[][] = [];
  // Keep the latest snapshot of a message without changing its display order.
  for (const message of new Map(
    messages.map((item) => [item.id, item]),
  ).values()) {
    if (message.role === "user") turns.push([]);
    else if (turns.length) turns[turns.length - 1].push(message);
  }
  const targets = new Map<string, Message[]>();
  turns.forEach((turn, index) => {
    if (isRunning && index === turns.length - 1) return;
    const visible = turn
      .filter(
        (message) =>
          (message.role === "assistant" &&
            Boolean(answerText(message.content ?? ""))) ||
          (message.role === "activity" &&
            message.activityType === "a2ui-surface"),
      )
      .filter((message) => !message.id.startsWith("dingent-run-progress-"));
    const last = visible.at(-1);
    if (
      last &&
      (visible.some((message) => message.role === "assistant") ||
        buildAnswerCopyText(turn))
    ) {
      targets.set(last.id, turn);
    }
  });
  return targets;
}
