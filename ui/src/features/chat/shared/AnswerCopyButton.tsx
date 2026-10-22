"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Message } from "@ag-ui/core";
import type { ReactCustomMessageRenderer } from "@copilotkit/react-core/v2";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildAnswerCopyText } from "./answer-copy";

export const AnswerCopyContext = createContext<ReadonlyMap<
  string,
  Message[]
> | null>(null);

function AnswerCopyButton({
  messages,
  wide,
}: {
  messages: Message[];
  wide: boolean;
}) {
  const t = useTranslations("Chat.copilot");
  const common = useTranslations("Common");
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    if (copying) return;
    setCopying(true);
    try {
      const text = buildAnswerCopyText(messages);
      if (!text) return;
      await navigator.clipboard.writeText(text);
      if (!mounted.current) return;
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      if (mounted.current) {
        setCopied(false);
        toast.error(common("error"));
      }
    } finally {
      if (mounted.current) setCopying(false);
    }
  }

  const label = t(copied ? "copied" : "copy");
  return (
    <div
      data-answer-copy
      className={`mb-4 flex w-full justify-end ${wide ? "" : "mx-auto max-w-3xl"}`}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={label}
            disabled={copying}
            onClick={copy}
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <span className="sr-only" role="status">
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
}

export const answerCopyRenderer: ReactCustomMessageRenderer = {
  render: function AnswerCopyFooter({ message, position }) {
    const targets = useContext(AnswerCopyContext);
    const messages =
      position === "after" ? targets?.get(message.id) : undefined;
    return messages ? (
      <AnswerCopyButton
        key={message.id}
        messages={messages}
        wide={message.role === "activity"}
      />
    ) : null;
  },
};
