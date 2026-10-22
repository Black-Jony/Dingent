import React from "react";
import { AssistantMessage } from "@ag-ui/core";
import { twMerge } from "tailwind-merge";
import {
  CopilotChatAssistantMessage,
  CopilotChatAssistantMessageProps,
} from "@copilotkit/react-core/v2";
import {
  ThinkingAccordion,
  type ExecutionTraceData,
} from "./ThinkingAccordion";
export function ThinkingAssistantMessage(
  props: CopilotChatAssistantMessageProps,
) {
  const message = props.message as AssistantMessage & ExecutionTraceData;
  const content = message.content || "";

  // Extract thinking content
  const regex = /<thinking>([\s\S]*?)<\/thinking>/;
  const match = content.match(regex);

  let thinkingContent = "";
  const cleanMessage = { ...message };

  if (match) {
    thinkingContent = match[1].trim();
    // Create a copy of the message with cleaned content for the main display
    cleanMessage.content = content.replace(match[0], "").trim();
  }
  const isRunProgress = message.id.startsWith("dingent-run-progress-");
  const latestAssistant = props.messages?.findLast(
    (item) => item.role === "assistant",
  );
  const isRunning = Boolean(
    props.isRunning &&
    (isRunProgress || !latestAssistant || latestAssistant.id === message.id),
  );
  if (!match) {
    return <CopilotChatAssistantMessage {...props} />;
  }
  const hasAnswer = cleanMessage.content.trim().length > 0;
  const hasToolCalls = Boolean(cleanMessage.toolCalls?.length);
  const isLivePlaceholder =
    isRunProgress || (!props.messages && !hasAnswer && !hasToolCalls);
  // Old snapshots can contain empty thinking tags on every assistant message.
  if (
    !thinkingContent &&
    !message.executionSteps?.length &&
    !message.executionFailed &&
    !message.executionStopped &&
    !(isLivePlaceholder && isRunning)
  ) {
    return hasAnswer || hasToolCalls ? (
      <CopilotChatAssistantMessage {...props} message={cleanMessage} />
    ) : null;
  }

  return (
    <div
      className={twMerge(
        "flex flex-col gap-2 w-full max-w-full",
        props.className,
      )}
    >
      <ThinkingAccordion
        messageId={message.id}
        key={isRunning ? "running" : "complete"}
        content={thinkingContent}
        isThinking={isRunning}
        defaultExpanded={false}
        steps={message.executionSteps}
        failed={message.executionFailed}
        stopped={message.executionStopped}
      />

      {(hasAnswer || hasToolCalls) && (
        <CopilotChatAssistantMessage
          {...props}
          message={cleanMessage}
          className=""
        />
      )}
    </div>
  );
}
