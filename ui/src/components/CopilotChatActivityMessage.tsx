import React, { useEffect, useMemo, useState } from "react";
import { ActivityMessage } from "@ag-ui/core";
import { twMerge } from "tailwind-merge";
import { useRenderActivityMessage } from "@copilotkit/react-core/v2";

/**
 * 内部使用的 Memoized 组件
 * 保持这个 Wrapper 存在，是为了确保列表中单个未变化的消息不会因为父组件重渲染而重绘
 */
const MemoizedActivityMessage = React.memo(
  function MemoizedActivityMessage({
    message,
    renderActivityMessage,
  }: {
    message: ActivityMessage;
    renderActivityMessage: (
      message: ActivityMessage,
    ) => React.ReactElement | null;
  }) {
    return renderActivityMessage(message);
  },
  (prevProps, nextProps) => {
    // 性能优化逻辑：只在 ID、类型或内容变化时重新渲染
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.message.activityType !== nextProps.message.activityType)
      return false;
    if (
      JSON.stringify(prevProps.message.content) !==
      JSON.stringify(nextProps.message.content)
    )
      return false;
    return true;
  },
);

export interface CopilotChatActivityListProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * 接收 Activity 消息数组
   */
  messages: ActivityMessage[];
}

function getLegacyDisplayContent(message: ActivityMessage): any {
  const content = message.content as any;
  if (Array.isArray(content)) {
    return content.find(
      (item) => item && typeof item === "object" && item.species_overview,
    );
  }
  return content;
}

function getSpeciesNameFromActivity(message: ActivityMessage): string | null {
  if (message.activityType !== "a2ui-surface") return null;
  const content = getLegacyDisplayContent(message);
  if (!content || typeof content !== "object") return null;

  const summarySpecies =
    typeof content.summary?.species_name === "string"
      ? content.summary.species_name.trim()
      : "";
  if (summarySpecies) return summarySpecies;

  const summaryFilter =
    typeof content.summary?.species_filter === "string"
      ? content.summary.species_filter.trim()
      : "";
  if (summaryFilter) return summaryFilter;

  const buttons = content.species_overview?.species_buttons;
  if (!Array.isArray(buttons)) return null;
  const active = buttons.find((button: any) => button?.active);
  return String(active?.name || buttons[0]?.name || "").trim() || null;
}

/**
 * 专门用于渲染 Activity 消息列表的组件
 */
export function CopilotChatActivityList({
  messages,
  className,
  ...props
}: CopilotChatActivityListProps) {
  // 获取渲染逻辑的 Hook
  const activityMessageRenderer = useRenderActivityMessage();
  const renderActivityMessage =
    typeof activityMessageRenderer === "function"
      ? activityMessageRenderer
      : activityMessageRenderer?.renderActivityMessage;
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const visibleMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    let lastTodoListIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const content = messages[i].content as any;
      if (
        content &&
        typeof content === "object" &&
        content.type === "todo_list"
      ) {
        lastTodoListIndex = i;
        break; // 找到了最后一个，停止循环
      }
    }

    return messages.filter((msg, index) => {
      const content = msg.content as any;

      const isTodoList =
        content && typeof content === "object" && content.type === "todo_list";

      if (isTodoList) {
        return index === lastTodoListIndex;
      }

      return true;
    });
  }, [messages]);

  const gwasMessageIds = useMemo(
    () =>
      visibleMessages
        .filter((message) => Boolean(getSpeciesNameFromActivity(message)))
        .map((message) => String(message.id)),
    [visibleMessages],
  );
  const latestGwasMessageId = gwasMessageIds.at(-1) ?? null;
  const gwasSignature = useMemo(
    () => gwasMessageIds.join("|"),
    [gwasMessageIds],
  );

  useEffect(() => {
    setCollapsedMap(() => {
      const next: Record<string, boolean> = {};
      for (const id of gwasSignature ? gwasSignature.split("|") : []) {
        next[id] = id !== latestGwasMessageId;
      }
      return next;
    });
  }, [gwasSignature, latestGwasMessageId]);

  if (
    !renderActivityMessage ||
    !visibleMessages ||
    visibleMessages.length === 0
  ) {
    return null;
  }
  // 使用 useMemo 计算最终需要显示的列表
  // 逻辑：保留所有非 'todo_list' 的消息，但对于 'todo_list'，只保留数组中出现的最后一个

  return (
    <div className={twMerge("flex flex-col gap-2", className)} {...props}>
      {visibleMessages.map((message) => {
        const messageId = String(message.id);
        const speciesName = getSpeciesNameFromActivity(message);
        if (!speciesName) {
          return (
            <MemoizedActivityMessage
              key={message.id}
              message={message}
              renderActivityMessage={renderActivityMessage}
            />
          );
        }

        const isCollapsed =
          collapsedMap[messageId] ?? messageId !== latestGwasMessageId;
        return (
          <div
            key={message.id}
            className="rounded-md border border-zinc-200 bg-white/50"
          >
            <button
              type="button"
              aria-expanded={!isCollapsed}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
              onClick={() =>
                setCollapsedMap((previous) => ({
                  ...previous,
                  [messageId]: !isCollapsed,
                }))
              }
            >
              <span>{`Species (${speciesName})`}</span>
              <span className="text-xs text-zinc-500">
                {isCollapsed ? "Expand" : "Collapse"}
              </span>
            </button>
            {!isCollapsed && (
              <div className="px-2 pb-2">
                <MemoizedActivityMessage
                  message={message}
                  renderActivityMessage={renderActivityMessage}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
