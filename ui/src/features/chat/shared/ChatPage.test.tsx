import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "./ChatPage";

const updateThreadTitle = vi.fn();
const addMessage = vi.fn();
const runAgent = vi.fn().mockResolvedValue(undefined);
const replace = vi.fn();
let sidebarAttachments:
  | {
      enabled: boolean;
      accept?: string;
      maxSize?: number;
      onUploadFailed?: (error: { message: string }) => void;
    }
  | undefined;
let activeThreadId = "thread-1";
let currentSearchParams = new URLSearchParams();
let agentSubscriber: {
  onActivitySnapshotEvent?: (input: { event: any }) => undefined;
  onEvent: (input: { event: any }) => undefined;
} | null = null;
const subscribe = vi.fn((subscriber) => {
  agentSubscriber = subscriber;
  return { unsubscribe: vi.fn() };
});

const agentMessages = [
  { id: "user-1", role: "user", content: "Run the tool" },
  {
    id: "activity-1",
    role: "activity",
    activityType: "a2ui-surface",
    content: { type: "table", label: "tool table" },
  },
  { id: "assistant-1", role: "assistant", content: "Done" },
  {
    id: "activity-2",
    role: "activity",
    activityType: "a2ui-surface",
    content: { type: "todo_list", label: "tool todos" },
  },
];

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "workspace-slug" }),
  usePathname: () => "/guest/workspace-slug/chat",
  useRouter: () => ({ replace }),
  useSearchParams: () => currentSearchParams,
}));

vi.mock("@copilotkit/react-core/v2", () => ({
  useAgent: () => ({
    agent: {
      isRunning: false,
      messages: agentMessages,
      subscribe,
      addMessage,
      threadId: "thread-1",
    },
  }),
  useCopilotKit: () => ({ copilotkit: { runAgent } }),
  useRenderActivityMessage: () => ({
    renderActivityMessage: (message: {
      id: string;
      content?: { label?: string };
    }) => (
      <div data-testid="activity-message">
        {message.id}:{message.content?.label}
      </div>
    ),
  }),
  CopilotSidebar: ({
    agentId,
    threadId,
    attachments,
    messageView: MessageView,
  }: {
    agentId?: string;
    threadId?: string;
    attachments?: typeof sidebarAttachments;
    messageView?: React.ComponentType<{
      messages: typeof agentMessages;
      isRunning: boolean;
    }>;
  }) => {
    sidebarAttachments = attachments;
    return (
      <div>
        <div data-testid="copilot-sidebar">
          {agentId}:{threadId}
        </div>
        {MessageView && (
          <MessageView messages={agentMessages} isRunning={false} />
        )}
      </div>
    );
  },
}));

vi.mock("@copilotkit/react-core", () => ({
  useRenderToolCall: vi.fn(),
}));

vi.mock("@/providers/ThreadProvider", () => ({
  useThreadContext: () => ({ activeThreadId, updateThreadTitle }),
}));

vi.mock("@/features/chat/chat-header", () => ({
  ChatHeader: () => <div data-testid="chat-header" />,
}));

vi.mock("@/features/workflows/hooks", () => ({
  useActiveWorkflow: () => ({ workflow: { name: "workflow-agent" } }),
  useApplyWorkflowFromUrl: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  getClientApi: () => ({
    forWorkspace: () => ({ workflows: {} }),
  }),
}));

vi.mock("@/components/CopilotChatMessageViewNoActivity", () => ({
  CopilotChatMessageViewNoActivity: ({
    messages,
    isRunning,
  }: {
    messages?: Array<{ id: string; content?: unknown }>;
    isRunning?: boolean;
  }) => (
    <div data-testid="message-view">
      {messages?.map((message) => (
        <div key={message.id}>{String(message.content ?? "")}</div>
      ))}
      {isRunning && <div data-testid="running-indicator" />}
    </div>
  ),
}));

vi.mock("@/components/common/todo-list-view", () => ({
  TodoListView: () => <div data-testid="todo-list" />,
}));

describe("ChatPage", () => {
  afterEach(() => {
    window.localStorage.removeItem("dingent.debugActivitySnapshot");
    activeThreadId = "thread-1";
    agentSubscriber = null;
    currentSearchParams = new URLSearchParams();
    addMessage.mockClear();
    runAgent.mockClear();
    replace.mockClear();
    subscribe.mockClear();
    sidebarAttachments = undefined;
  });

  it("enables image attachments for file selection, drop, and clipboard paste", () => {
    render(<ChatPage />);

    expect(sidebarAttachments).toMatchObject({
      enabled: true,
      accept: "image/png,image/jpeg,image/webp",
      maxSize: 5 * 1024 * 1024,
    });
    expect(sidebarAttachments?.onUploadFailed).toEqual(expect.any(Function));
  });

  it("passes parsed frontend activity messages from CopilotKit agent state to the middle activity list", () => {
    render(<ChatPage />);

    expect(screen.getByTestId("copilot-sidebar")).toHaveTextContent(
      "workflow-agent:thread-1",
    );
    expect(screen.getByText("activity-1:tool table")).toBeInTheDocument();
    expect(screen.getByText("activity-2:tool todos")).toBeInTheDocument();
    expect(screen.getAllByTestId("activity-message")).toHaveLength(2);
    expect(screen.queryByText("user-1:")).not.toBeInTheDocument();
    expect(screen.queryByText("assistant-1:")).not.toBeInTheDocument();
  });

  it("renders activity snapshot events before the final messages snapshot", () => {
    render(<ChatPage />);

    act(() => {
      agentSubscriber?.onActivitySnapshotEvent?.({
        event: {
          type: "ACTIVITY_SNAPSHOT",
          messageId: "activity-live",
          activityType: "a2ui-surface",
          content: { label: "live table" },
        },
      });
    });

    expect(screen.getByText("activity-live:live table")).toBeInTheDocument();
  });

  it("throws when debug activity snapshot assertions are enabled", () => {
    window.localStorage.setItem("dingent.debugActivitySnapshot", "throw");
    render(<ChatPage />);

    expect(() => {
      agentSubscriber?.onActivitySnapshotEvent?.({
        event: {
          type: "ACTIVITY_SNAPSHOT",
          messageId: "activity-live",
          activityType: "a2ui-surface",
          content: { label: "live table" },
        },
      });
    }).toThrow("Received ACTIVITY_SNAPSHOT activity message: activity-live");
  });

  it("keeps live thinking visible after assistant text starts", () => {
    render(<ChatPage />);

    act(() => {
      agentSubscriber?.onEvent({ event: { type: "THINKING_START" } });
      agentSubscriber?.onEvent({
        event: {
          type: "THINKING_TEXT_MESSAGE_CONTENT",
          delta: "checking tools",
        },
      });
      agentSubscriber?.onEvent({ event: { type: "TEXT_MESSAGE_START" } });
    });

    expect(screen.getByText("Thinking Process...")).toBeInTheDocument();
    expect(screen.getByText("checking tools")).toBeInTheDocument();
  });

  it("logs aggregated chat response timings when a run completes", () => {
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const performanceNow = vi
      .spyOn(performance, "now")
      .mockImplementation(() => 100);
    render(<ChatPage />);

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "run-1" },
      });
      agentSubscriber?.onEvent({
        event: { type: "THINKING_TEXT_MESSAGE_CONTENT", delta: "thinking" },
      });
      agentSubscriber?.onEvent({
        event: { type: "TEXT_MESSAGE_CONTENT", delta: "hello" },
      });
      agentSubscriber?.onEvent({ event: { type: "TOOL_CALL_START" } });
      agentSubscriber?.onEvent({
        event: {
          type: "ACTIVITY_SNAPSHOT",
          messageId: "activity-live",
          content: { label: "live table" },
        },
      });
      agentSubscriber?.onEvent({
        event: { type: "RUN_FINISHED", runId: "run-1" },
      });
    });

    expect(consoleInfo).toHaveBeenCalledWith(
      "[Dingent] chat response timings",
      expect.objectContaining({
        runId: "run-1",
        terminalEvent: "RUN_FINISHED",
        timeToFirstTokenMs: expect.any(Number),
        totalDurationMs: expect.any(Number),
        textDeltaCount: 1,
        textCharCount: 5,
        thinkingDeltaCount: 1,
        thinkingCharCount: 8,
        activityCount: 1,
        toolCallCount: 1,
      }),
    );

    consoleInfo.mockRestore();
    performanceNow.mockRestore();
  });

  it("clears live thinking when switching threads", () => {
    const { rerender } = render(<ChatPage />);

    act(() => {
      agentSubscriber?.onEvent({ event: { type: "THINKING_START" } });
      agentSubscriber?.onEvent({
        event: {
          type: "THINKING_TEXT_MESSAGE_CONTENT",
          delta: "old thread thought",
        },
      });
    });
    expect(screen.getByText("old thread thought")).toBeInTheDocument();

    activeThreadId = "thread-2";
    rerender(<ChatPage />);

    expect(screen.queryByText("old thread thought")).not.toBeInTheDocument();
  });

  it("runs a URL query once with the selected workflow and removes launch parameters", async () => {
    let finishRun: (() => void) | undefined;
    runAgent.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishRun = resolve;
        }),
    );
    currentSearchParams = new URLSearchParams({
      workflow: "workflow-agent",
      query: "Find BRCA1 pathways",
      embed: "1",
    });

    render(<ChatPage />);

    await waitFor(() => {
      expect(addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "user",
          content: "Find BRCA1 pathways",
        }),
      );
      expect(runAgent).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Find BRCA1 pathways")).toBeInTheDocument();
      expect(screen.getByTestId("running-indicator")).toBeInTheDocument();
      expect(replace).toHaveBeenCalledWith(
        "/guest/workspace-slug/chat?embed=1",
        { scroll: false },
      );
    });

    await act(async () => finishRun?.());
  });
});
