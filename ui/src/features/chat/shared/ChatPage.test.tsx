import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "./ChatPage";
import type { ExecutionTraceData } from "./ThinkingAccordion";

const updateThreadTitle = vi.fn();
const addMessage = vi.fn();
const runAgent = vi.fn().mockResolvedValue(undefined);
const stopAgent = vi.fn();
const detachActiveRun = vi.fn().mockResolvedValue(undefined);
const replace = vi.fn();
const closeArtifact = vi.fn();
let sidebarAttachments:
  | {
      enabled: boolean;
      accept?: string;
      maxSize?: number;
      onUploadFailed?: (error: { message: string }) => void;
    }
  | undefined;
let activeThreadId = "thread-1";
let workflowName = "workflow-agent";
let translationRevision = 0;
let copilotIsRunning = false;
let currentSearchParams = new URLSearchParams();
let agentSubscriber: {
  onToolCallStartEvent?: (input: { event: any }) => undefined;
  onActivitySnapshotEvent?: (input: { event: any }) => undefined;
  onRunFinalized?: () => undefined;
  onRunFailed?: () => undefined;
  onEvent: (input: { event: any }) => undefined;
} | null = null;
type ToolCallRenderer = (input: {
  status: string;
  args: Record<string, unknown>;
  result?: unknown;
}) => ReactNode;
let toolCallRenderer: ToolCallRenderer | null = null;
let renderedTrace: ExecutionTraceData | undefined;
let stopCurrentRunHandler: (() => Promise<void>) | undefined;
const subscribe = vi.fn((subscriber) => {
  agentSubscriber = subscriber;
  return { unsubscribe: vi.fn() };
});

const defaultAgentMessages = [
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
let agentMessages = [...defaultAgentMessages];
const mockedAgent = {
  isRunning: false,
  get messages() {
    return agentMessages;
  },
  subscribe,
  addMessage,
  threadId: "thread-1",
  detachActiveRun,
};

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  const messages = (await import("../../../../messages/en.json")).default;
  const translate = actual.createTranslator({
    locale: "en",
    messages,
    namespace: "Chat",
  });
  const alternateTranslate = actual.createTranslator({
    locale: "en",
    messages,
    namespace: "Chat",
  });
  // Keep the translator stable, as next-intl does between locale changes.
  return {
    ...actual,
    useLocale: () => "en",
    useTranslations: () =>
      translationRevision ? alternateTranslate : translate,
  };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "workspace-slug" }),
  usePathname: () => "/guest/workspace-slug/chat",
  useRouter: () => ({ replace }),
  useSearchParams: () => currentSearchParams,
}));

vi.mock("@copilotkit/react-core/v2", async () => {
  const { memo } = await import("react");
  // CopilotKit memoizes slots when messages and run props have not changed.
  const MemoizedMessageSlot = memo(
    ({
      component: Component,
      ...props
    }: {
      component: React.ComponentType<{
        messages: typeof agentMessages;
        isRunning: boolean;
      }>;
      messages: typeof agentMessages;
      isRunning: boolean;
    }) => <Component {...props} />,
  );
  return {
    useAgent: () => ({
      agent: mockedAgent,
    }),
    useCopilotKit: () => ({ copilotkit: { runAgent, stopAgent } }),
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
    CopilotChat: ({
      agentId,
      threadId,
      attachments,
      messageView: MessageView,
      onStop,
    }: {
      agentId?: string;
      threadId?: string;
      attachments?: typeof sidebarAttachments;
      messageView?: React.ComponentType<{
        messages: typeof agentMessages;
        isRunning: boolean;
      }>;
      onStop?: () => Promise<void>;
    }) => {
      sidebarAttachments = attachments;
      stopCurrentRunHandler = onStop;
      return (
        <div>
          <div data-testid="copilot-chat">
            {agentId}:{threadId}
          </div>
          {MessageView && (
            <MemoizedMessageSlot
              component={MessageView}
              messages={agentMessages}
              isRunning={copilotIsRunning}
            />
          )}
        </div>
      );
    },
  };
});

vi.mock("@copilotkit/react-core", () => ({
  useRenderToolCall: (config: { name: string; render: ToolCallRenderer }) => {
    if (config.name === "write_todos") toolCallRenderer = config.render;
  },
}));

vi.mock("@/providers/ThreadProvider", () => ({
  useThreadContext: () => ({ activeThreadId, updateThreadTitle }),
}));

vi.mock("@/features/chat/chat-header", () => ({
  ChatHeader: () => <div data-testid="chat-header" />,
}));

vi.mock("./AnalysisWorkspace", () => ({
  AnalysisWorkspaceProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  AnalysisWorkspaceSlot: () => <div data-testid="analysis-workspace-slot" />,
  useAnalysisWorkspace: () => ({ artifact: null, closeArtifact }),
}));

vi.mock("@/features/workflows/hooks", () => ({
  useActiveWorkflow: () => ({ workflow: { name: workflowName } }),
  useApplyWorkflowFromUrl: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  getClientApi: () => ({
    forWorkspace: () => ({ workflows: {} }),
  }),
}));

vi.mock("./DingentChatMessageView", () => {
  const MockMessageView = ({
    messages,
    isRunning,
  }: {
    messages?: Array<{
      id: string;
      role?: string;
      content?: unknown;
    }>;
    isRunning?: boolean;
  }) => {
    renderedTrace = messages?.find((message) =>
      message.id.startsWith("dingent-run-progress-"),
    ) as ExecutionTraceData | undefined;
    return (
      <div data-testid="message-view">
        {messages?.map((message) => (
          <div key={message.id}>
            {message.role === "activity"
              ? message.id +
                ":" +
                ((message.content as { label?: string })?.label ?? "")
              : String(message.content ?? "")}
          </div>
        ))}
        {isRunning && <div data-testid="running-indicator" />}
      </div>
    );
  };
  MockMessageView.Cursor = function MockCursor() {
    return null;
  };
  MockMessageView.displayName = "MockMessageView";

  return { DingentChatMessageView: MockMessageView };
});

describe("ChatPage", () => {
  afterEach(() => {
    window.localStorage.removeItem("dingent.debugActivitySnapshot");
    activeThreadId = "thread-1";
    workflowName = "workflow-agent";
    translationRevision = 0;
    mockedAgent.threadId = "thread-1";
    copilotIsRunning = false;
    agentMessages = [...defaultAgentMessages];
    agentSubscriber = null;
    currentSearchParams = new URLSearchParams();
    addMessage.mockClear();
    runAgent.mockClear();
    stopAgent.mockClear();
    detachActiveRun.mockClear();
    stopCurrentRunHandler = undefined;
    replace.mockClear();
    closeArtifact.mockClear();
    subscribe.mockClear();
    sidebarAttachments = undefined;
    toolCallRenderer = null;
    renderedTrace = undefined;
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

  it("keeps distinct real calls but hides internal planning in the structured trace", () => {
    render(<ChatPage />);
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "trace-run" },
      });
      for (const id of ["call-1", "call-1", "call-2"])
        agentSubscriber?.onToolCallStartEvent?.({
          event: { toolCallId: id, toolCallName: "search_records" },
        });
      agentSubscriber?.onToolCallStartEvent?.({
        event: { toolCallId: "plan-call", toolCallName: "write_todos" },
      });
      agentSubscriber?.onEvent({
        event: { type: "TOOL_CALL_RESULT", toolCallId: "call-1" },
      });
    });
    expect(renderedTrace?.executionSteps).toMatchObject([
      { id: "call-1", toolName: "search_records", status: "complete" },
      { id: "call-2", toolName: "search_records", status: "running" },
    ]);
    expect(renderedTrace?.executionSteps).toHaveLength(2);
    expect(screen.getByTestId("message-view")).not.toHaveTextContent(
      "write todos",
    );
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_ERROR", runId: "trace-run" },
      });
    });
    expect(renderedTrace?.executionFailed).toBe(true);
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
  });

  it("clears structured execution state when a new conversation is opened", () => {
    const { rerender } = render(<ChatPage />);
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "trace-run" },
      });
      agentSubscriber?.onToolCallStartEvent?.({
        event: { toolCallId: "call-1", toolCallName: "search_records" },
      });
    });
    expect(renderedTrace?.executionSteps).toHaveLength(1);
    agentMessages = [];
    activeThreadId = "new-trace-thread";
    rerender(<ChatPage />);
    expect(renderedTrace).toBeUndefined();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("refreshes completed tool traces through a memoized message slot", () => {
    copilotIsRunning = true;
    render(<ChatPage />);
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "cached-run" },
      });
      agentSubscriber?.onToolCallStartEvent?.({
        event: {
          toolCallId: "cached-tool",
          toolCallName: "direct_index_status",
        },
      });
    });
    expect(renderedTrace?.executionSteps).toHaveLength(1);
    expect(screen.getByTestId("running-indicator")).toBeInTheDocument();
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "TOOL_CALL_RESULT", toolCallId: "cached-tool" },
      });
      agentSubscriber?.onEvent({
        event: { type: "RUN_FINISHED", runId: "cached-run" },
      });
    });
    expect(renderedTrace?.executionSteps?.[0].status).toBe("complete");
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
  });

  it("settles execution state when the stream finalizes without a terminal event", () => {
    copilotIsRunning = true;
    render(<ChatPage />);
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "closed-stream" },
      });
      agentSubscriber?.onToolCallStartEvent?.({
        event: { toolCallId: "stream-tool", toolCallName: "search_records" },
      });
    });
    act(() => agentSubscriber?.onRunFinalized?.());
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
    expect(renderedTrace?.executionSteps?.[0].status).toBe("running");
  });

  it("marks failed streams without leaving a running indicator", () => {
    copilotIsRunning = true;
    render(<ChatPage />);
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "failed-stream" },
      });
    });
    act(() => {
      agentSubscriber?.onRunFailed?.();
      agentSubscriber?.onRunFinalized?.();
    });
    expect(renderedTrace?.executionFailed).toBe(true);
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
  });

  it("ignores late events and finalizers from a disposed conversation subscription", () => {
    copilotIsRunning = true;
    const { rerender } = render(<ChatPage />);
    const oldSubscriber = agentSubscriber!;
    activeThreadId = "thread-2";
    rerender(<ChatPage />);
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "new-run" },
      });
      agentSubscriber?.onToolCallStartEvent?.({
        event: { toolCallId: "new-call", toolCallName: "current_tool" },
      });
    });
    act(() => {
      oldSubscriber.onEvent({
        event: { type: "RUN_STARTED", runId: "old-run" },
      });
      oldSubscriber.onToolCallStartEvent?.({
        event: { toolCallId: "old-call", toolCallName: "old_tool" },
      });
      oldSubscriber.onActivitySnapshotEvent?.({
        event: { messageId: "old-activity", content: { label: "Old result" } },
      });
      oldSubscriber.onEvent({ event: { type: "RUN_ERROR", runId: "old-run" } });
      oldSubscriber.onRunFailed?.();
      oldSubscriber.onRunFinalized?.();
    });
    expect(renderedTrace?.executionSteps).toMatchObject([
      { id: "new-call", toolName: "current_tool" },
    ]);
    expect(renderedTrace?.executionSteps).toHaveLength(1);
    expect(renderedTrace?.executionFailed).toBe(false);
    expect(screen.getByTestId("running-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("message-view")).not.toHaveTextContent(
      "Old result",
    );
  });

  it("resets execution state and ignores the old workflow when workflows change", () => {
    const { rerender } = render(<ChatPage />);
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "old-workflow-run" },
      });
      agentSubscriber?.onToolCallStartEvent?.({
        event: {
          toolCallId: "old-workflow-call",
          toolCallName: "old_workflow_tool",
        },
      });
    });
    const oldSubscriber = agentSubscriber!;
    workflowName = "new-workflow-agent";
    rerender(<ChatPage />);
    act(() => {
      oldSubscriber.onToolCallStartEvent?.({
        event: {
          toolCallId: "late-workflow-call",
          toolCallName: "late_workflow_tool",
        },
      });
      oldSubscriber.onRunFailed?.();
      oldSubscriber.onRunFinalized?.();
    });
    expect(renderedTrace).toBeUndefined();
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
    expect(screen.getByTestId("message-view")).not.toHaveTextContent(
      "old workflow tool",
    );
    expect(screen.getByTestId("message-view")).not.toHaveTextContent(
      "late workflow tool",
    );
  });

  it("keeps the active event subscription when the interface translator changes", () => {
    const { rerender } = render(<ChatPage />);
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "locale-run" },
      });
      agentSubscriber?.onToolCallStartEvent?.({
        event: { toolCallId: "locale-call", toolCallName: "search_records" },
      });
    });
    const currentSubscriber = agentSubscriber!;
    subscribe.mockClear();
    translationRevision = 1;
    rerender(<ChatPage />);
    expect(subscribe).not.toHaveBeenCalled();
    act(() => {
      currentSubscriber.onEvent({
        event: { type: "TOOL_CALL_RESULT", toolCallId: "locale-call" },
      });
      currentSubscriber.onEvent({
        event: { type: "RUN_FINISHED", runId: "locale-run" },
      });
    });
    expect(renderedTrace?.executionSteps?.[0].status).toBe("complete");
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
  });

  it("detaches a stopped stream locally and resets the stopped flag for the next question", async () => {
    copilotIsRunning = true;
    render(<ChatPage />);
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "stopped-run" },
      });
      agentSubscriber?.onToolCallStartEvent?.({
        event: { toolCallId: "stopped-call", toolCallName: "search_records" },
      });
    });
    await act(async () => stopCurrentRunHandler?.());
    expect(stopAgent).toHaveBeenCalledWith({ agent: mockedAgent });
    expect(detachActiveRun).toHaveBeenCalledTimes(1);
    expect(renderedTrace?.executionStopped).toBe(true);
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "next-run" },
      });
    });
    expect(renderedTrace?.executionStopped).toBe(false);
    expect(renderedTrace?.executionSteps).toHaveLength(0);
    expect(screen.getByTestId("running-indicator")).toBeInTheDocument();
  });

  it("does not render repeated plan acknowledgments without a task list", () => {
    render(<ChatPage />);
    const renderer = toolCallRenderer!;
    render(
      <>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index}>
            {renderer({
              status: "complete",
              args: {},
              result: "Updated todo list",
            })}
          </div>
        ))}
      </>,
    );
    expect(screen.queryByText("Plan updated.")).not.toBeInTheDocument();
    expect(screen.queryByText("Execution Plan")).not.toBeInTheDocument();
  });

  it("hides populated plan arguments and their text acknowledgment", () => {
    render(<ChatPage />);
    const plan = toolCallRenderer!({
      status: "complete",
      args: {
        todos: [{ content: "Check databases", status: "in_progress" }],
      },
      result: "Updated todo list to [{'content': 'Check databases'}]",
    });
    expect(plan).toBeNull();
    render(<>{plan}</>);
    expect(screen.queryByText("Execution Plan")).not.toBeInTheDocument();
    expect(screen.queryByText("Check databases")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan updated.")).not.toBeInTheDocument();
  });

  it("hides structured plans while streaming and when replaying completed results", () => {
    render(<ChatPage />);
    const renderer = toolCallRenderer!;
    for (const status of ["inProgress", "executing", "complete"]) {
      expect(
        renderer({
          status,
          args: {
            todos: [{ content: "Current task", status: "in_progress" }],
          },
          result: JSON.stringify({
            todos: [{ content: "Finished search", status: "completed" }],
          }),
        }),
      ).toBeNull();
      expect(
        renderer({
          status,
          args: {},
          result: {
            todos: [{ content: "Finished search", status: "completed" }],
          },
        }),
      ).toBeNull();
    }
    expect(screen.queryByText("Execution Plan")).not.toBeInTheDocument();
    expect(screen.queryByText("Working...")).not.toBeInTheDocument();
  });

  it("keeps empty or malformed plans hidden", () => {
    render(<ChatPage />);
    render(
      <>
        {toolCallRenderer!({
          status: "complete",
          args: {
            todos: [{ content: "Old task", status: "pending" }],
          },
          result: { todos: [] },
        })}
        {toolCallRenderer!({
          status: "complete",
          args: { todos: [null] },
          result: { todos: ["bad"] },
        })}
        {toolCallRenderer!({
          status: "executing",
          args: {},
          result: undefined,
        })}
      </>,
    );
    expect(screen.queryByText("Execution Plan")).not.toBeInTheDocument();
    expect(screen.queryByText("Old task")).not.toBeInTheDocument();
  });

  it("closes the analysis workspace when the active thread changes", () => {
    const { rerender } = render(<ChatPage />);
    closeArtifact.mockClear();

    activeThreadId = "thread-2";
    rerender(<ChatPage />);

    expect(closeArtifact).toHaveBeenCalledTimes(1);
  });

  it("keeps frontend activity messages in the assistant conversation stream", () => {
    render(<ChatPage />);

    expect(screen.getByTestId("copilot-chat")).toHaveTextContent(
      "workflow-agent:thread-1",
    );
    expect(screen.getByText("activity-1:tool table")).toBeInTheDocument();
    expect(screen.getByText("activity-2:tool todos")).toBeInTheDocument();
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
    const messageText = screen.getByTestId("message-view").textContent || "";
    expect(messageText.indexOf("activity-live:live table")).toBeLessThan(
      messageText.indexOf("Done"),
    );
  });

  it("hides multi-task plans without hiding the answer or other tool results", () => {
    render(<ChatPage />);

    expect(toolCallRenderer).not.toBeNull();
    render(
      <>
        {toolCallRenderer?.({
          status: "complete",
          args: {},
          result: {
            todos: [
              { content: "Fetch records", status: "completed" },
              { content: "Analyze results", status: "in_progress" },
            ],
          },
        })}
      </>,
    );

    expect(screen.queryByText("Execution Plan")).not.toBeInTheDocument();
    expect(screen.queryByText("Fetch records")).not.toBeInTheDocument();
    expect(screen.queryByText("Analyze results")).not.toBeInTheDocument();
    expect(screen.getByTestId("message-view")).toHaveTextContent("Done");
    expect(screen.getByTestId("message-view")).toHaveTextContent("tool table");
  });

  it("ignores obsolete debug flags when displaying an activity", () => {
    window.localStorage.setItem("dingent.debugActivitySnapshot", "throw");
    render(<ChatPage />);

    expect(() =>
      act(() => {
        agentSubscriber?.onActivitySnapshotEvent?.({
          event: {
            type: "ACTIVITY_SNAPSHOT",
            messageId: "activity-live",
            activityType: "a2ui-surface",
            content: { label: "live table" },
          },
        });
      }),
    ).not.toThrow();
    expect(screen.getByTestId("message-view")).toHaveTextContent("live table");
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
      agentSubscriber?.onToolCallStartEvent?.({
        event: {
          type: "TOOL_CALL_START",
          toolCallId: "tool-call-1",
          toolCallName: "generate_gwas_sankey",
        },
      });
      agentSubscriber?.onActivitySnapshotEvent?.({
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
    const messageText = screen.getByTestId("message-view").textContent || "";
    expect(messageText).toContain("Using tool: generate gwas sankey");
    expect(messageText.indexOf("<thinking>")).toBeLessThan(
      messageText.indexOf("activity-live:live table"),
    );

    consoleInfo.mockRestore();
    performanceNow.mockRestore();
  });

  it("labels an A2UI activity result with its originating tool", () => {
    render(<ChatPage />);

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "run-databases" },
      });
      agentSubscriber?.onToolCallStartEvent?.({
        event: {
          type: "TOOL_CALL_START",
          toolCallId: "call-databases",
          toolCallName: "list_annotation_databases",
        },
      });
      agentSubscriber?.onActivitySnapshotEvent?.({
        event: {
          type: "ACTIVITY_SNAPSHOT",
          messageId: "call-databases:activity",
          activityType: "a2ui-surface",
          content: [{ surfaceId: "call-databases-0", a2ui_operations: [] }],
        },
      });
    });

    const messageText = screen.getByTestId("message-view").textContent || "";
    expect(messageText).toContain("Using tool: list annotation databases");
    expect(messageText).toContain("Received result: list annotation databases");
    expect(messageText).not.toContain("Received result: a2ui-surface");
  });

  it("shows one result step for multiple A2UI surfaces from one tool", () => {
    render(<ChatPage />);

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "run-tables" },
      });
      agentSubscriber?.onToolCallStartEvent?.({
        event: {
          type: "TOOL_CALL_START",
          toolCallId: "call-tables",
          toolCallName: "query_database_record",
        },
      });
      for (let index = 0; index < 4; index += 1) {
        agentSubscriber?.onActivitySnapshotEvent?.({
          event: {
            type: "ACTIVITY_SNAPSHOT",
            messageId: `call-tables:activity:${index}`,
            activityType: "a2ui-surface",
            content: { surfaceId: `table-${index}`, a2ui_operations: [] },
          },
        });
      }
    });

    const messageText = screen.getByTestId("message-view").textContent || "";
    expect(
      messageText.match(/Received result: query database record/g),
    ).toHaveLength(1);
    expect(messageText).not.toContain("Received result: a2ui-surface");
    for (let index = 0; index < 4; index += 1) {
      expect(messageText).toContain(`call-tables:activity:${index}:`);
    }
  });

  it("does not expose A2UI protocol names as execution steps", () => {
    render(<ChatPage />);

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "run-unnamed" },
      });
      agentSubscriber?.onActivitySnapshotEvent?.({
        event: {
          type: "ACTIVITY_SNAPSHOT",
          messageId: "unassociated-activity",
          activityType: "a2ui-surface",
          content: { a2ui_operations: [] },
        },
      });
    });

    const messageText = screen.getByTestId("message-view").textContent || "";
    expect(messageText).not.toContain("Received result: a2ui-surface");
    expect(messageText).toContain("unassociated-activity:");
  });

  it("shows only a temporary loader for a tool-free run and removes it on completion", () => {
    render(<ChatPage />);

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "run-without-details" },
      });
    });
    expect(screen.getByTestId("message-view")).toHaveTextContent(
      "<thinking></thinking>",
    );
    expect(screen.getByTestId("message-view")).not.toHaveTextContent(
      "Initializing",
    );

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_FINISHED", runId: "run-without-details" },
      });
    });
    expect(screen.getByTestId("message-view")).not.toHaveTextContent(
      "<thinking></thinking>",
    );
  });

  it("clears Working after a terminal event even if CopilotKit still reports running", () => {
    copilotIsRunning = true;
    render(<ChatPage />);

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "run-1" },
      });
    });
    expect(screen.getByTestId("running-indicator")).toBeInTheDocument();

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_FINISHED", runId: "run-1" },
      });
    });
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
    expect(screen.getByTestId("message-view")).not.toHaveTextContent(
      "<thinking></thinking>",
    );

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "run-2" },
      });
    });
    expect(screen.getByTestId("running-indicator")).toBeInTheDocument();

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_ERROR", runId: "run-2" },
      });
    });
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
  });

  it("never carries a previous run process panel into an empty new thread", () => {
    const { rerender } = render(<ChatPage />);

    act(() => {
      agentSubscriber?.onEvent({
        event: { type: "RUN_STARTED", runId: "previous-run" },
      });
      agentSubscriber?.onToolCallStartEvent?.({
        event: {
          type: "TOOL_CALL_START",
          toolCallId: "previous-tool-call",
          toolCallName: "previous_tool",
        },
      });
    });
    expect(screen.getByTestId("message-view")).toHaveTextContent(
      "Using tool: previous tool",
    );

    agentMessages = [];
    activeThreadId = "thread-empty";
    rerender(<ChatPage />);

    expect(screen.getByTestId("message-view")).not.toHaveTextContent(
      "Using tool: previous tool",
    );
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("shows three starter questions and sends the selected prompt", async () => {
    agentMessages = [];
    render(<ChatPage />);

    const suggestions = screen.getAllByRole("button");
    expect(suggestions).toHaveLength(3);

    suggestions[0].click();

    await waitFor(() => {
      expect(addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ role: "user" }),
      );
      expect(runAgent).toHaveBeenCalledTimes(1);
    });
  });

  it("does not let an old starter request clear the next conversation's pending state", async () => {
    let finishOldRun: (() => void) | undefined;
    let finishNewRun: (() => void) | undefined;
    runAgent
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishOldRun = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishNewRun = resolve;
          }),
      );
    agentMessages = [];
    const { rerender } = render(<ChatPage />);
    await act(async () => screen.getAllByRole("button")[0].click());
    expect(screen.getByTestId("running-indicator")).toBeInTheDocument();
    activeThreadId = "new-pending-thread";
    rerender(<ChatPage />);
    await act(async () => screen.getAllByRole("button")[0].click());
    expect(screen.getByTestId("running-indicator")).toBeInTheDocument();
    await act(async () => finishOldRun?.());
    expect(screen.getByTestId("running-indicator")).toBeInTheDocument();
    await act(async () => finishNewRun?.());
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
  });

  it("does not let an old URL request clear a newer pending URL question", async () => {
    let finishOldRun: (() => void) | undefined;
    let finishNewRun: (() => void) | undefined;
    runAgent
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishOldRun = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishNewRun = resolve;
          }),
      );
    agentMessages = [];
    currentSearchParams = new URLSearchParams({ query: "Old URL question" });
    const { rerender } = render(<ChatPage />);
    await waitFor(() => expect(runAgent).toHaveBeenCalledTimes(1));
    activeThreadId = "new-url-thread";
    currentSearchParams = new URLSearchParams({ query: "New URL question" });
    rerender(<ChatPage />);
    await waitFor(() => expect(runAgent).toHaveBeenCalledTimes(2));
    await act(async () => finishOldRun?.());
    expect(screen.getByTestId("running-indicator")).toBeInTheDocument();
    await act(async () => finishNewRun?.());
    expect(screen.queryByTestId("running-indicator")).not.toBeInTheDocument();
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
