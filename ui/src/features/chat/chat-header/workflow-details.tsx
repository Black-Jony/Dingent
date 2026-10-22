"use client";

import React, { useRef, useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useClickOutside } from "@/hooks/use-click-outside";

export const WorkflowDetails: React.FC<{ description?: string }> = ({
  description,
}) => {
  const t = useTranslations("Chat.workflow");
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useClickOutside(panelRef, () => setIsOpen(false), buttonRef);

  if (!description) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={t("info")}
        aria-expanded={isOpen}
        title={t("info")}
      >
        <Info className="size-4" />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-3 text-sm leading-relaxed text-popover-foreground shadow-lg"
        >
          <div className="mb-1 font-medium">{t("about")}</div>
          <p className="text-muted-foreground">{description}</p>
        </div>
      )}
    </div>
  );
};
