import {
  A2UIProvider,
  A2UIRenderer,
  useA2UIActions,
} from "@copilotkit/a2ui-renderer";
import { z } from "zod";
import {
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ColumnDef } from "@tanstack/react-table";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import {
  AlertCircle,
  ArrowUpDown,
  Ban,
  ChevronDown,
  ChevronUp,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./A2UI/data-table";
import { ErrorBoundary } from "react-error-boundary";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import { useTranslations } from "next-intl";

type ReactActivityMessageRenderer<TContent = any> = {
  activityType: string;
  content: z.ZodType<TContent>;
  render: React.ComponentType<{
    activityType: string;
    content: TContent;
    message: any;
    agent: any;
  }>;
};

// --- 1. 类型定义 ---

interface TableContent {
  type: "table";
  title?: string;
  columns: string[];
  rows: Array<Record<string, any> | any[]>;
}
interface MarkdownContent {
  type: "markdown";
  title?: string;
  content: string;
}

// 联合类型
type A2UIContent = TableContent | MarkdownContent;

interface OfficialA2UIContent {
  a2ui_operations: Record<string, any>[];
  surfaceId?: string;
}

interface LegacyTableContent {
  title?: string;
  columns?: unknown[];
  rows?: Array<Record<string, any> | any[]>;
}

interface LegacySpeciesButton {
  org_id: number;
  name: string;
  count: number;
  active?: boolean;
}

interface LegacyDisplayContent {
  title?: string;
  text?: unknown;
  sankey_image_base64?: string;
  association_table?: LegacyTableContent;
  species_overview?: {
    association_table?: LegacyTableContent;
    species_buttons?: LegacySpeciesButton[];
  };
  summary?: {
    mode?: string;
    trait_name?: string;
    species_name?: string;
    species_filter?: string;
  };
  data?: { mode?: string };
}

function normalizeTableContent(content: TableContent): TableContent {
  const columns = Array.isArray(content.columns)
    ? content.columns.map(String)
    : [];
  const rows = Array.isArray(content.rows)
    ? content.rows.map((row) => {
        if (Array.isArray(row)) {
          return Object.fromEntries(
            columns.map((column, index) => [column, row[index]]),
          );
        }

        return row && typeof row === "object" ? row : {};
      })
    : [];

  return { ...content, columns, rows };
}

function formatCellValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function renderCellValue(value: unknown): ReactNode {
  if (
    value &&
    typeof value === "object" &&
    "href" in value &&
    "text" in value
  ) {
    const href = String((value as { href: unknown }).href);
    const text = String((value as { text: unknown }).text);
    if (/^https?:\/\//i.test(href)) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {text}
        </a>
      );
    }
    return text;
  }

  const text = formatCellValue(value);
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a
        key={`${match.index}-${match[2]}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {match[1]}
      </a>,
    );
    lastIndex = linkPattern.lastIndex;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  const t = useTranslations("Renderer");
  const common = useTranslations("Common");

  return (
    <div className="p-4 border border-red-200 bg-red-50 rounded-md text-red-600 flex flex-col gap-2 my-2">
      <div className="flex items-center gap-2 font-semibold">
        <Ban className="w-4 h-4" />
        <span>{t("componentError")}</span>
      </div>
      <p className="text-sm opacity-80 break-all">{error.message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={resetErrorBoundary}
        className="w-fit mt-2 bg-white"
      >
        {common("retry")}
      </Button>
    </div>
  );
}

function TableView({ data }: { data: TableContent }) {
  const t = useTranslations("Renderer");
  const normalizedData = useMemo(() => normalizeTableContent(data), [data]);
  const { columns: rawColumns, rows, title } = normalizedData;

  const safeColumns = useMemo<ColumnDef<any>[]>(() => {
    try {
      if (!rawColumns || !Array.isArray(rawColumns)) return [];

      return rawColumns.map((colName) => ({
        accessorKey: colName,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8"
          >
            {colName}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          try {
            const value = row.getValue(colName);
            return <div className="font-medium">{renderCellValue(value)}</div>;
          } catch (e) {
            return <span className="text-red-400 text-xs">{t("error")}</span>;
          }
        },
      }));
    } catch (e) {
      console.error("Error generating columns:", e);
      return [];
    }
  }, [rawColumns, t]);

  if (!rawColumns || rawColumns.length === 0) {
    return <div className="p-4 text-gray-500 italic">{t("noColumns")}</div>;
  }

  return (
    <div className="w-full my-4 space-y-2">
      {title && (
        <h3 className="text-lg font-semibold tracking-tight px-1">{title}</h3>
      )}
      {safeColumns.length > 0 ? (
        <DataTable columns={safeColumns} data={rows || []} />
      ) : (
        <div className="text-sm text-red-500">{t("couldNotRenderColumns")}</div>
      )}
    </div>
  );
}

function toLegacyTable(
  table: LegacyTableContent | undefined,
  fallbackTitle: string,
): TableContent | null {
  if (!table) return null;
  const columns = Array.isArray(table.columns) ? table.columns.map(String) : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  if (columns.length === 0) return null;

  return {
    type: "table",
    title: table.title || fallbackTitle,
    columns,
    rows,
  };
}

function getActiveSpeciesName(content: LegacyDisplayContent): string {
  const summarySpecies = content.summary?.species_name?.trim();
  if (summarySpecies) return summarySpecies;

  const summaryFilter = content.summary?.species_filter?.trim();
  if (summaryFilter) return summaryFilter;

  const buttons = content.species_overview?.species_buttons;
  const active = buttons?.find((species) => species.active);
  return String(active?.name || buttons?.[0]?.name || "").trim();
}

function LegacyDisplayView({ content }: { content: LegacyDisplayContent }) {
  const t = useTranslations("Renderer");
  const imageBase64 = content.sankey_image_base64;
  const speciesButtons = content.species_overview?.species_buttons;
  const mode = content.summary?.mode ?? content.data?.mode;
  const isTraitMode = mode === "trait";
  const activeSpeciesName = getActiveSpeciesName(content);
  const title = content.summary?.trait_name ?? content.title;
  const resultTable = toLegacyTable(content.association_table, t("results"));
  const overviewTable = toLegacyTable(
    content.species_overview?.association_table,
    activeSpeciesName ? `${t("species")} (${activeSpeciesName})` : t("species"),
  );

  const handleSwitchSpecies = (species: LegacySpeciesButton) => {
    window.dispatchEvent(
      new CustomEvent("gwas-switch-species", {
        detail: { speciesName: species.name, orgId: species.org_id },
      }),
    );
  };

  if (!imageBase64 && !resultTable && !overviewTable && content.text != null) {
    return (
      <MarkdownView
        data={{ type: "markdown", title, content: String(content.text) }}
      />
    );
  }

  const imageSrc = imageBase64?.startsWith("data:")
    ? imageBase64
    : imageBase64
      ? `data:image/png;base64,${imageBase64}`
      : null;

  return (
    <div className="w-full my-4 space-y-4">
      {!isTraitMode && speciesButtons && speciesButtons.length > 0 && (
        <div className="rounded-md border px-3 py-3">
          <div className="mb-2 text-sm font-medium text-gray-700">
            {t("species")}
          </div>
          <div className="flex flex-wrap gap-2">
            {speciesButtons.map((species) => (
              <Button
                key={`${species.org_id}-${species.name}`}
                size="sm"
                variant={species.active ? "default" : "outline"}
                className={
                  species.active ? "bg-green-600 hover:bg-green-700" : ""
                }
                onClick={() => handleSwitchSpecies(species)}
              >
                {`${species.name} (${species.count})`}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!isTraitMode && overviewTable && <TableView data={overviewTable} />}

      {imageSrc && (
        <div className="space-y-2">
          {title && (
            <h3 className="text-lg font-semibold tracking-tight px-1">
              {title}
            </h3>
          )}
          <PhotoProvider maskOpacity={0.8}>
            <PhotoView src={imageSrc}>
              <img
                src={imageSrc}
                alt={title || t("sankeyDiagram")}
                className="max-w-full h-auto rounded border cursor-zoom-in"
              />
            </PhotoView>
          </PhotoProvider>
        </div>
      )}

      {resultTable && <TableView data={resultTable} />}

      {!imageSrc && !resultTable && !overviewTable && (
        <div className="p-4 text-gray-500 italic">{t("noData")}</div>
      )}
    </div>
  );
}

function isLegacyDisplayContent(content: Record<string, any>): boolean {
  return (
    "association_table" in content ||
    "sankey_image_base64" in content ||
    "species_overview" in content ||
    ("text" in content && !("type" in content))
  );
}

const PreviewImage = (props: any) => {
  const { src, alt, title, ...rest } = props;
  if (!src) return null;

  return (
    // 使用 PhotoView 包裹 img
    // src: 大图地址 (这里和缩略图一样)
    <PhotoView src={src}>
      <img
        src={src}
        alt={alt || title || "markdown image"}
        title={title}
        {...rest}
        // cursor-zoom-in 提示用户可点击
        className="rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm my-4 max-w-full h-auto object-cover cursor-zoom-in hover:opacity-95 transition-opacity"
        loading="lazy"
      />
    </PhotoView>
  );
};

const MarkdownView = memo(
  ({ data }: { data: MarkdownContent }) => {
    const t = useTranslations("Renderer");
    const { title, content } = data;
    const [isExpanded, setIsExpanded] = useState(false);

    const deferredContent = useDeferredValue(content);
    if (!content) return null;

    const COLLAPSE_THRESHOLD = 300;
    const isLongContent = content.length > COLLAPSE_THRESHOLD;
    const shouldCollapse = isLongContent && !isExpanded;

    if (!content) return null;

    return (
      <div className="w-full my-4 space-y-2">
        {title && (
          <div className="flex items-center gap-2 mb-2">
            <ListTodo className="w-4 h-4 text-primary" />
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 overflow-hidden relative">
          <div
            className={`
            p-4 transition-all duration-300 ease-in-out
            ${shouldCollapse ? "max-h-[160px] overflow-hidden" : "max-h-none"}
          `}
          >
            <PhotoProvider maskOpacity={0.8}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                className="prose prose-sm dark:prose-invert max-w-none break-words"
                urlTransform={(value) => value}
                components={{
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong
                      {...props}
                      className="font-bold text-slate-800 dark:text-slate-200"
                    />
                  ),
                  // 将图片处理逻辑交给 PreviewImage 组件（或者直接渲染）
                  img: PreviewImage,
                }}
              >
                {/* ✅ 直接使用 deferredContent */}
                {deferredContent}
              </ReactMarkdown>
            </PhotoProvider>
          </div>

          {shouldCollapse && (
            <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-slate-50 to-transparent dark:from-slate-900 pointer-events-none" />
          )}

          {/* 展开/收起按钮代码保持不变 */}
          {isLongContent && (
            <div
              className={`flex justify-center p-2 ${isExpanded ? "border-t border-slate-200 dark:border-slate-800" : "absolute bottom-0 w-full z-10"}`}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                // ... 样式代码
              >
                {isExpanded ? (
                  <>
                    {" "}
                    <ChevronUp className="w-3 h-3 mr-1" /> {t("showLess")}{" "}
                  </>
                ) : (
                  <>
                    {" "}
                    <ChevronDown className="w-3 h-3 mr-1" />{" "}
                    {t("showMore")}{" "}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
    // 这里的比较函数是性能优化的关键，只有 raw content 变了才重绘
  },
  (prevProps, nextProps) => {
    return (
      prevProps.data.content === nextProps.data.content &&
      prevProps.data.title === nextProps.data.title
    );
  },
);
MarkdownView.displayName = "MarkdownView";

function getSurfaceId(content: OfficialA2UIContent) {
  if (content.surfaceId) return content.surfaceId;

  for (const operation of content.a2ui_operations) {
    const surfaceId = operation.createSurface?.surfaceId;
    if (typeof surfaceId === "string") return surfaceId;
  }

  return undefined;
}

function OfficialA2UIRenderer({ content }: { content: OfficialA2UIContent }) {
  const t = useTranslations("Renderer");
  const { processMessages } = useA2UIActions();
  const surfaceId = getSurfaceId(content);

  useEffect(() => {
    processMessages(content.a2ui_operations);
  }, [content.a2ui_operations, processMessages]);

  if (!surfaceId) {
    return (
      <div className="p-4 border border-red-200 rounded text-red-500 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        <span>{t("surfaceMissing")}</span>
      </div>
    );
  }

  return <A2UIRenderer surfaceId={surfaceId} />;
}

function OfficialA2UISurface({
  content,
  theme,
}: {
  content: OfficialA2UIContent;
  theme?: any;
}) {
  return (
    <A2UIProvider theme={theme}>
      <OfficialA2UIRenderer content={content} />
    </A2UIProvider>
  );
}

function InvalidDataError() {
  const t = useTranslations("Renderer");
  return (
    <div className="p-4 border border-red-200 rounded text-red-500 flex items-center gap-2">
      <AlertCircle className="w-4 h-4" />
      <span>{t("invalidData")}</span>
    </div>
  );
}

function UnknownContentType({ type }: { type: unknown }) {
  const t = useTranslations("Renderer");
  return (
    <p className="font-semibold">
      {t("unknownContentType", { type: String(type) })}
    </p>
  );
}

// --- 5. 主渲染器工厂函数 ---

export type MessageRendererOptions = {
  theme?: any;
};

export function createA2UIMessageRenderer(
  options: MessageRendererOptions,
): ReactActivityMessageRenderer<any> {
  const renderContent = (content: any) => {
    if (!content || typeof content !== "object") {
      return <InvalidDataError />;
    }

    if (Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((item, index) => (
            <div key={index}>{renderContent(item)}</div>
          ))}
        </div>
      );
    }

    if (Array.isArray(content.a2ui_operations)) {
      return (
        <OfficialA2UISurface
          content={content as OfficialA2UIContent}
          theme={options.theme}
        />
      );
    }

    if (isLegacyDisplayContent(content)) {
      return <LegacyDisplayView content={content as LegacyDisplayContent} />;
    }

    const typedContent = content as A2UIContent;

    switch (typedContent.type) {
      case "table":
        return <TableView data={typedContent} />;
      case "markdown":
        return <MarkdownView data={typedContent} />;

      default:
        if ("rows" in content && "columns" in content) {
          return <TableView data={{ ...content, type: "table" }} />;
        }

        return (
          <div className="p-4 border border-yellow-200 bg-yellow-50 rounded text-yellow-700 text-sm">
            <UnknownContentType type={content.type} />
            <pre className="mt-2 text-xs opacity-80 overflow-auto max-h-40">
              {JSON.stringify(content, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return {
    activityType: "a2ui-surface",
    content: z.any() as any,

    render: ({ content }) => {
      // 2. 根据 type 分发渲染逻辑
      // 使用 ErrorBoundary 包裹整个动态内容，确保任意组件崩溃不影响聊天主界面
      return (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {renderContent(content)}
        </ErrorBoundary>
      );
    },
  };
}
