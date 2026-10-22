import React from "react";
import { X } from "lucide-react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { getClientApi } from "@/lib/api/client";
import { useAuthStore } from "@/store";
import { WorkflowSelector } from "./workflow-selector";
import { WorkflowDetails } from "./workflow-details";
import { useTranslations } from "next-intl";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LanguageSwitch } from "@/components/common/language-switch";
import {
  useActiveWorkflow,
  useWorkflowsList,
} from "@/features/workflows/hooks";

interface ChatHeaderProps {
  className?: string;
  onClose?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  className = "",
  onClose,
}) => {
  const common = useTranslations("Common");
  const chat = useTranslations("Chat");
  const params = useParams();
  const slug = params.slug as string;
  const pathname = usePathname();
  const isEmbedded = useSearchParams().get("embed") === "1";
  const isGuest = pathname.startsWith("/guest/");
  const hideWorkflowSelector = isEmbedded || isGuest;
  const visitorId = useAuthStore((state) => state.visitorId);
  const api = getClientApi().forWorkspace(slug, {
    isGuest,
    visitorId: isGuest ? (visitorId ?? undefined) : undefined,
  });

  const workflowsQ = useWorkflowsList(api.workflows, slug);
  const {
    id: activeId,
    setActiveId,
    workflow,
  } = useActiveWorkflow(api.workflows, slug);
  const workflows = workflowsQ.data || [];
  return (
    <header
      className={`z-40 flex h-14 w-full shrink-0 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 ${className}`}
    >
      <div className="flex w-full min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <div className="min-w-0 truncate text-sm font-semibold">
            {chat("copilot.title")}
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          {!hideWorkflowSelector && workflow?.description && (
            <WorkflowDetails description={workflow.description} />
          )}
          <LanguageSwitch showLabel />
          {!hideWorkflowSelector && (
            <WorkflowSelector
              workflows={workflows}
              activeId={activeId}
              setActiveId={setActiveId}
              isLoading={workflowsQ.isLoading}
            />
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={common("close")}
              title={common("close")}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
