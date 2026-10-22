import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Message, ToolCall } from "@ag-ui/core";
import { ThinkingCursor } from "./ThinkingCursor";
import { TodoListView } from "@/components/common/todo-list-view";

vi.mock("@/features/chat/shared/ThinkingAssistantMessage", () => ({
  ThinkingAssistantMessage: () => null,
}));

vi.mock("@copilotkit/react-core/v2", () => {
  const CopilotChatMessageView = () => null;
  CopilotChatMessageView.Cursor = function DefaultCursor() {
    return null;
  };

  return {
    CopilotChatAssistantMessage: () => null,
    CopilotChatMessageView,
  };
});

import {
  DingentChatMessageView,
  getLatestPlanMessages,
} from "./DingentChatMessageView";

const call = (id: string, name = "write_todos"): ToolCall => ({
  id,
  type: "function",
  function: { name, arguments: "{}" },
});

describe("DingentChatMessageView", () => {
  it("uses the empty Dingent cursor instead of the CopilotKit default cursor", () => {
    expect(DingentChatMessageView.Cursor).toBe(ThinkingCursor);
  });

  it("keeps only the latest plan per user turn without changing stored messages", () => {
    const messages: Message[] = [
      { id: "user-1", role: "user", content: "First question" },
      {
        id: "assistant-1",
        role: "assistant",
        content: "Checking",
        toolCalls: [call("plan-1"), call("search-1", "search")],
      },
      {
        id: "assistant-2",
        role: "assistant",
        content: "Done",
        toolCalls: [call("plan-2")],
      },
      { id: "user-2", role: "user", content: "Second question" },
      {
        id: "assistant-3",
        role: "assistant",
        toolCalls: [call("plan-3"), call("plan-4")],
      },
      {
        id: "result-1",
        role: "activity",
        activityType: "a2ui-surface",
        content: { title: "Data" },
      },
    ];
    const displayed = getLatestPlanMessages(messages);
    expect(
      displayed.flatMap((message) =>
        message.role === "assistant"
          ? (message.toolCalls?.map((tool) => tool.id) ?? [])
          : [],
      ),
    ).toEqual(["search-1", "plan-2", "plan-4"]);
    expect(messages[1]).toMatchObject({
      toolCalls: [call("plan-1"), call("search-1", "search")],
    });
    expect(displayed[1]).toMatchObject({ content: "Checking" });
    expect(displayed.at(-1)).toBe(messages.at(-1));
  });

  it("deduplicates snapshots before choosing the latest plan", () => {
    const first: Message = {
      id: "assistant-1",
      role: "assistant",
      content: "Old",
      toolCalls: [call("plan-1")],
    };
    const second: Message = {
      id: "assistant-2",
      role: "assistant",
      toolCalls: [call("plan-2")],
    };
    const displayed = getLatestPlanMessages([
      first,
      second,
      { ...first, content: "Latest" },
    ]);
    expect(displayed).toHaveLength(2);
    expect(displayed[0]).toMatchObject({ content: "Latest", toolCalls: [] });
    expect(displayed[1]).toMatchObject({ toolCalls: [call("plan-2")] });
  });

  it("does not animate a historical plan that still has an in-progress task", () => {
    const { container } = render(
      <TodoListView
        data={[{ content: "Historical task", status: "in_progress" }]}
        isRunning={false}
      />,
    );
    expect(screen.getByText("Historical task")).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("removes superseded plan-only rows without removing their stored tool results", () => {
    const messages: Message[] = [
      { id: "old-plan", role: "assistant", toolCalls: [call("plan-1")] },
      {
        id: "old-result",
        role: "tool",
        toolCallId: "plan-1",
        content: "Updated todo list",
      },
      { id: "new-plan", role: "assistant", toolCalls: [call("plan-2")] },
    ];
    expect(
      getLatestPlanMessages(messages).map((message) => message.id),
    ).toEqual(["old-result", "new-plan"]);
    expect(messages).toHaveLength(3);
  });
});
