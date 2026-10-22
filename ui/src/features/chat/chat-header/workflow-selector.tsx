import React, { useRef, useState } from "react";
import { Bot, Check, ChevronDown, Loader2, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import { useClickOutside } from "@/hooks/use-click-outside";
import { WorkflowSummary } from "@/types/entity";

interface WorkflowSelectorProps {
  workflows: WorkflowSummary[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  isLoading: boolean;
}

export const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({
  workflows,
  activeId,
  setActiveId,
  isLoading,
}) => {
  const t = useTranslations("Chat");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false), buttonRef);

  const activeWorkflow = workflows.find((workflow) => workflow.id === activeId);

  const handleSelect = (id: string) => {
    setActiveId(id);
    setIsOpen(false);
  };

  return (
    <div className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !isLoading && setIsOpen((open) => !open)}
        disabled={isLoading || workflows.length === 0}
        className="group inline-flex h-9 w-full max-w-[15rem] items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-foreground shadow-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {isLoading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Bot className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">
          {isLoading
            ? t("workflow.loading")
            : workflows.length === 0
              ? t("workflow.none")
              : activeWorkflow?.name || t("workflow.select")}
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          className="absolute end-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <div className="max-h-72 overflow-y-auto">
            {workflows.map((workflow) => {
              const isActive = activeId === workflow.id;
              return (
                <button
                  key={workflow.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(workflow.id)}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-start text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Workflow className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{workflow.name}</span>
                  {isActive && <Check className="size-4 shrink-0" />}
                </button>
              );
            })}
            {workflows.length === 0 && (
              <div className="px-3 py-5 text-center text-sm text-muted-foreground">
                {t("workflow.noneAvailable")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
