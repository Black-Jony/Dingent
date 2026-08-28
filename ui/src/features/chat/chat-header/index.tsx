import React from "react";
import { X } from "lucide-react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { getClientApi } from "@/lib/api/client";
import { WorkflowSelector } from "./workflow-selector";
import { WorkflowDetails } from "./workflow-details";
import { useTranslations } from "next-intl";
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
  const params = useParams();
  const slug = params.slug as string;
  const pathname = usePathname();
  const isEmbedded = useSearchParams().get("embed") === "1";
  const hideWorkflowSelector = isEmbedded || pathname.startsWith("/guest/");
  const api = getClientApi().forWorkspace(slug);

  // 数据获取
  const workflowsQ = useWorkflowsList(api.workflows, slug);
  const {
    id: activeId,
    setActiveId,
    workflow,
  } = useActiveWorkflow(api.workflows, slug);
  const workflows = workflowsQ.data || [];
  const showTopBar = !hideWorkflowSelector || Boolean(onClose);
  const showDescription = Boolean(workflow?.description);

  if (!showTopBar && !showDescription) return null;

  return (
    <header
      className={`
      flex flex-col w-full z-40
      bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800
      ${className}
    `}
    >
      {/* 顶部栏 */}
      {showTopBar && (
        <div className="flex items-center justify-between px-4 h-16 w-full max-w-7xl mx-auto">
          {/* 左侧：选择器 */}
          <div className="flex-1 flex items-center min-w-0">
            {!hideWorkflowSelector && (
              <WorkflowSelector
                workflows={workflows}
                activeId={activeId}
                setActiveId={setActiveId}
                isLoading={workflowsQ.isLoading}
              />
            )}
          </div>

          {/* 右侧：操作区 */}
          <div className="flex items-center gap-2">
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center justify-center w-8 h-8 rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 transition-all active:scale-95"
                aria-label={common("close")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 底部扩展区域：描述信息 */}
      {showDescription && (
        <div
          className={`px-4 pb-3 ${showTopBar ? "-mt-2" : "pt-3"} max-w-7xl mx-auto w-full`}
        >
          <WorkflowDetails description={workflow!.description!} />
        </div>
      )}
    </header>
  );
};
