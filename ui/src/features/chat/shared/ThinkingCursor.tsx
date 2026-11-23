"use client";

import { useContext } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { RunProgressContext } from "./ThinkingAccordion";

export function ThinkingCursor() {
  const progress = useContext(RunProgressContext);
  const t = useTranslations("Chat.thinking");
  if (
    !progress ||
    progress.executionStartedAt == null ||
    progress.runHasEnded ||
    progress.executionFailed ||
    progress.executionStopped ||
    progress.thinkingText.trim() ||
    progress.executionSteps.length
  )
    return null;

  return (
    <div
      data-testid="chat-waiting-indicator"
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-3xl items-center gap-2 py-2 text-sm text-muted-foreground"
    >
      <Loader2
        aria-hidden="true"
        className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
      />
      <span>{t("thinking")}</span>
    </div>
  );
}
