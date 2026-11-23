"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  Circle,
  Database,
  FileText,
  Globe,
  Lightbulb,
  Loader2,
  Search,
  Square,
  Wrench,
  X,
} from "lucide-react";
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useMemo,
  useId,
} from "react";
import { twMerge } from "tailwind-merge";
import { Streamdown } from "streamdown";

export interface ExecutionStep {
  id: string;
  toolName?: string;
  label: string;
  status: "running" | "complete";
  detail?: string;
}

export interface ExecutionTraceData {
  executionSteps?: ExecutionStep[];
  executionFailed?: boolean;
  executionStopped?: boolean;
  executionStartedAt?: number;
  executionDurationMs?: number;
}

export interface RunProgressState {
  messageId: string;
  thinkingText: string;
  isThinking: boolean;
  runHasEnded: boolean;
  executionSteps: ExecutionStep[];
  executionFailed: boolean;
  executionStopped?: boolean;
  executionStartedAt?: number;
  executionDurationMs?: number;
}

export const RunProgressContext = createContext<RunProgressState | null>(null);

interface ThinkingAccordionProps {
  messageId?: string;
  content: string;
  isThinking?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  label?: string;
  steps?: ExecutionStep[];
  failed?: boolean;
  stopped?: boolean;
  startedAt?: number;
  durationMs?: number;
}

function toolIcon(name: string = "") {
  if (/chart|plot|sankey|visual/i.test(name)) return ChartNoAxesCombined;
  if (/database|query|index|annotation/i.test(name)) return Database;
  if (/browse|fetch_url|webpage|website/i.test(name)) return Globe;
  if (/search|lookup|find/i.test(name)) return Search;
  if (/file|document|read|paper/i.test(name)) return FileText;
  return Wrench;
}

export function ThinkingAccordion({
  messageId,
  content: initialContent,
  isThinking: initialThinking = false,
  defaultExpanded = false,
  className,
  label,
  steps: initialSteps = [],
  failed: initialFailed = false,
  stopped: initialStopped = false,
  startedAt: initialStartedAt,
  durationMs: initialDurationMs,
}: ThinkingAccordionProps) {
  const progress = useContext(RunProgressContext);
  // The library's assistant-message cache ignores custom trace metadata.
  const live = progress?.messageId === messageId ? progress : null;
  const content = live ? live.thinkingText : initialContent;
  const steps = live ? live.executionSteps : initialSteps;
  const failed = live ? live.executionFailed : initialFailed;
  const stopped = live ? Boolean(live.executionStopped) : initialStopped;
  const isThinking = live
    ? !live.runHasEnded && (initialThinking || live.isThinking)
    : initialThinking;
  const startedAt = live ? live.executionStartedAt : initialStartedAt;
  const durationMs = live ? live.executionDurationMs : initialDurationMs;
  const t = useTranslations("Chat.thinking");
  const locale = useLocale();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || isThinking);
  const previousRunning = useRef(isThinking);
  const [now, setNow] = useState(Date.now);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const groups = useMemo(() => {
    const grouped = new Map<string, ExecutionStep[]>();
    for (const step of steps) {
      const key = step.toolName ?? step.id;
      const calls = grouped.get(key) ?? [];
      calls.push(step);
      grouped.set(key, calls);
    }
    return Array.from(grouped, ([key, calls]) => ({ key, calls }));
  }, [steps]);
  const currentStep = steps.findLast((step) => step.status === "running");
  const displayLabel =
    label ??
    (isThinking
      ? (currentStep?.label ?? t("thinking"))
      : stopped
        ? t("stopped")
        : failed
          ? t("failed")
          : t("completed"));
  const hasDetails = Boolean(content.trim() || groups.length);
  const elapsed =
    durationMs ??
    (isThinking && startedAt != null
      ? Math.max(0, now - startedAt)
      : undefined);
  const elapsedLabel =
    elapsed == null
      ? null
      : new Intl.NumberFormat(locale, {
          style: "unit",
          unit: "second",
          unitDisplay: "short",
          maximumFractionDigits: 0,
        }).format(Math.max(0, elapsed) / 1000);

  useEffect(() => {
    if (previousRunning.current !== isThinking) setIsExpanded(isThinking);
    previousRunning.current = isThinking;
  }, [isThinking]);
  useEffect(() => {
    if (!isThinking || startedAt == null || !hasDetails) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isThinking, startedAt, hasDetails]);
  useEffect(() => {
    if (isThinking && isExpanded && scrollRef.current) {
      const element = scrollRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [content, steps, isExpanded, isThinking]);
  if (!hasDetails && (failed || stopped)) {
    return (
      <div
        className={twMerge(
          "flex min-h-9 items-center gap-2 text-muted-foreground text-sm py-1.5",
          className,
        )}
        role={failed && !stopped ? "alert" : "status"}
      >
        {stopped ? (
          <Square className="size-3.5 shrink-0" aria-hidden="true" />
        ) : failed ? (
          <X
            className="size-3.5 shrink-0 text-destructive"
            aria-hidden="true"
          />
        ) : (
          <Loader2
            className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        <span>
          {stopped ? t("stopped") : failed ? t("failed") : t("thinking")}
        </span>
      </div>
    );
  }
  if (!hasDetails) return null;
  return (
    <div
      data-execution-trace
      className={twMerge("my-3 w-full min-w-0 text-sm", className)}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          setIsExpanded(!isExpanded);
        }}
        className="group flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md py-1.5 text-start text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        aria-label={`${t("process")}: ${displayLabel}`}
        title={displayLabel}
      >
        {isThinking ? (
          <Loader2
            className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : stopped ? (
          <Square className="size-3.5 shrink-0" aria-hidden="true" />
        ) : failed ? (
          <X
            className="size-3.5 shrink-0 text-destructive"
            aria-hidden="true"
          />
        ) : (
          <Check className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate" aria-live="polite">
          {displayLabel}
        </span>
        {elapsedLabel && (
          <span
            data-execution-duration
            className="shrink-0 text-xs tabular-nums text-muted-foreground"
          >
            {elapsedLabel}
          </span>
        )}
        {groups.length > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {t("stepCount", { count: groups.length })}
          </span>
        )}
        <ChevronDown
          className={`size-3 shrink-0 opacity-60 transition-transform motion-reduce:transition-none ${isExpanded ? "" : "-rotate-90 rtl:rotate-90"}`}
          aria-hidden="true"
        />
      </button>
      {isExpanded && (
        <div
          ref={scrollRef}
          id={panelId}
          className="mt-1 max-h-80 space-y-3 overflow-y-auto overscroll-contain pb-1 pe-2"
        >
          {content.trim() && (
            <div
              data-model-reasoning
              className="flex min-w-0 gap-3 py-1 text-[13px] leading-6 text-muted-foreground"
            >
              <Lightbulb
                className="mt-1 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] [&_p]:my-1 [&_pre]:overflow-x-auto">
                <Streamdown>{content}</Streamdown>
              </div>
            </div>
          )}
          {groups.length > 0 && (
            <ol className="ms-1.5 space-y-2.5 border-s border-border/60 ps-5 py-1 text-[13px]">
              {groups.map(({ key, calls }) => {
                const active =
                  isThinking && calls.some((call) => call.status === "running");
                const complete = calls.every(
                  (call) => call.status === "complete",
                );
                const detail = calls.findLast((call) => call.detail)?.detail;
                const Icon = toolIcon(calls[0].toolName);
                return (
                  <li key={key} className="relative min-w-0 leading-5">
                    <span
                      className="absolute -start-[27px] top-1 bg-background"
                      aria-hidden="true"
                    >
                      {active ? (
                        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                      ) : complete ? (
                        <Check className="size-3.5 text-muted-foreground" />
                      ) : (
                        <Circle className="size-3.5 text-muted-foreground/60" />
                      )}
                    </span>
                    <div
                      className={`break-words ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                      <span className="flex items-start gap-2">
                        <Icon
                          className="mt-0.5 size-3.5 shrink-0 opacity-70"
                          aria-hidden="true"
                        />
                        {calls[0].label}
                      </span>
                    </div>
                    {calls.length > 1 ? (
                      <details className="mt-1 text-xs text-muted-foreground">
                        <summary className="w-fit cursor-pointer select-none py-0.5 hover:text-foreground">
                          {t("callDetails", { count: calls.length })}
                        </summary>
                        <ol className="mt-1.5 space-y-1.5 border-s border-border ps-3">
                          {calls.map((call, index) => (
                            <li key={call.id} className="flex min-w-0 gap-2">
                              <span className="shrink-0 tabular-nums">
                                {index + 1}.
                              </span>
                              <span className="min-w-0 break-words">
                                {call.detail ?? call.label}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : (
                      detail && (
                        <div className="mt-0.5 break-words text-xs text-muted-foreground/80">
                          {detail}
                        </div>
                      )
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
