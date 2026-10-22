import { ThinkingAssistantMessage } from "@/features/chat/shared/ThinkingAssistantMessage";
import { ThinkingCursor } from "@/features/chat/shared/ThinkingCursor";
import { useMemo } from "react";
import { AnswerCopyContext } from "./AnswerCopyButton";
import { getAnswerCopyTargets } from "./answer-copy";
import {
  CopilotChatAssistantMessage,
  CopilotChatMessageView,
  type CopilotChatMessageViewProps,
  type CopilotChatAssistantMessageProps,
} from "@copilotkit/react-core/v2";
import type { Message } from "@ag-ui/core";

function EmptyCopyButton() {
  return null;
}

function AnswerAssistantMessage(props: CopilotChatAssistantMessageProps) {
  return <ThinkingAssistantMessage {...props} copyButton={EmptyCopyButton} />;
}

export function getLatestPlanMessages(messages: readonly Message[]): Message[] {
  const uniqueMessages = Array.from(
    new Map(messages.map((message) => [message.id, message])).values(),
  );
  const hiddenPlans = new Set<string>();
  let previousPlanId: string | undefined;
  for (const message of uniqueMessages) {
    if (message.role === "user") previousPlanId = undefined;
    if (message.role !== "assistant") continue;
    for (const call of message.toolCalls ?? []) {
      if (call.function.name !== "write_todos") continue;
      if (previousPlanId && previousPlanId !== call.id)
        hiddenPlans.add(previousPlanId);
      previousPlanId = call.id;
    }
  }
  if (!hiddenPlans.size) return uniqueMessages;
  // Filter display copies only: persisted messages and other tool calls stay intact.
  return uniqueMessages.flatMap((message) => {
    if (
      message.role !== "assistant" ||
      !message.toolCalls?.some((call) => hiddenPlans.has(call.id))
    )
      return [message];
    const toolCalls = message.toolCalls.filter(
      (call) => !hiddenPlans.has(call.id),
    );
    if (!toolCalls.length && !message.content?.trim()) return [];
    return [
      {
        ...message,
        toolCalls,
      },
    ];
  });
}

const DingentChatMessageViewImpl = (props: CopilotChatMessageViewProps) => {
  const displayMessages = useMemo(
    () => getLatestPlanMessages(props.messages ?? []),
    [props.messages],
  );
  const targets = useMemo(
    () => getAnswerCopyTargets(props.messages ?? [], Boolean(props.isRunning)),
    [props.messages, props.isRunning],
  );
  return (
    <AnswerCopyContext.Provider value={targets}>
      <CopilotChatMessageView
        {...props}
        messages={displayMessages}
        cursor={ThinkingCursor}
        assistantMessage={
          AnswerAssistantMessage as typeof CopilotChatAssistantMessage
        }
      />
    </AnswerCopyContext.Provider>
  );
};

DingentChatMessageViewImpl.Cursor = ThinkingCursor;
DingentChatMessageViewImpl.AssistantMessage = ThinkingAssistantMessage;

export const DingentChatMessageView =
  DingentChatMessageViewImpl as typeof CopilotChatMessageView;
