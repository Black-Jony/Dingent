"use client";

import { useTranslations } from "next-intl";
import { Check, ChevronDown, Circle, Loader2, Square, X } from "lucide-react";
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
}

export interface RunProgressState {
  messageId: string;
  thinkingText: string;
  isThinking: boolean;
  runHasEnded: boolean;
  executionSteps: ExecutionStep[];
  executionFailed: boolean;
  executionStopped?: boolean;
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
}
export function ThinkingAccordion({
  messageId,
  content,
  isThinking = false,
  defaultExpanded = false,
  className,
  label,
  steps = [],
  failed = false,
  stopped = false,
}: ThinkingAccordionProps) {
  const progress = useContext(RunProgressContext);
  // The library's assistant-message cache ignores custom trace metadata.
  if (progress && progress.messageId === messageId) {
    content = progress.thinkingText;
    steps = progress.executionSteps;
    failed = progress.executionFailed;
    stopped = Boolean(progress.executionStopped);
    isThinking = !progress.runHasEnded && (isThinking || progress.isThinking);
  }
  const t = useTranslations("Chat.thinking");
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
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

  useEffect(() => {
    if (!isThinking) setIsExpanded(false);
  }, [isThinking]);
  useEffect(() => {
    if (isThinking && isExpanded && scrollRef.current) {
      const element = scrollRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [content, steps, isExpanded, isThinking]);
  if (!hasDetails && (isThinking || failed || stopped)) {
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
      className={twMerge("my-2 w-full min-w-0 text-sm", className)}
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
          className="mt-2 max-h-64 overflow-y-auto overscroll-contain pb-1 pe-2"
        >
          {groups.length > 0 ? (
            <ol className="ms-1.5 space-y-3 border-s border-border/70 ps-5 py-1 text-[13px]">
              {groups.map(({ key, calls }) => {
                const active =
                  isThinking && calls.some((call) => call.status === "running");
                const complete = calls.every(
                  (call) => call.status === "complete",
                );
                const detail = calls.findLast((call) => call.detail)?.detail;
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
                      {calls[0].label}
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
          ) : (
            <div className="border-s border-border/70 ps-5 text-[13px] leading-relaxed text-muted-foreground [&>p]:my-1">
              <Streamdown>{content}</Streamdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
