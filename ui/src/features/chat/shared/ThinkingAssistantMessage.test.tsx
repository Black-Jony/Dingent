import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { memo } from "react";
import { ThinkingAssistantMessage } from "./ThinkingAssistantMessage";
import {
  ThinkingAccordion,
  RunProgressContext,
  type RunProgressState,
  type ExecutionTraceData,
} from "./ThinkingAccordion";

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@copilotkit/react-core/v2", () => ({
  CopilotChatAssistantMessage: ({
    message,
  }: {
    message: { content?: string };
  }) => <div data-testid="assistant-message">{message.content}</div>,
}));

describe("ThinkingAssistantMessage", () => {
  it("shows real model reasoning alongside tool steps while running and collapses on completion", () => {
    const steps = [
      {
        id: "search-1",
        toolName: "search_records",
        label: "search records",
        status: "complete" as const,
      },
    ];
    const { container, rerender } = render(
      <ThinkingAccordion
        content="Check the evidence first."
        steps={steps}
        isThinking
      />,
    );
    expect(screen.getByText("Check the evidence first.")).toBeVisible();
    expect(screen.getByText("search records")).toBeVisible();
    expect(
      container.querySelector("[data-model-reasoning]"),
    ).toBeInTheDocument();
    rerender(
      <ThinkingAccordion content="Check the evidence first." steps={steps} />,
    );
    expect(screen.getByRole("button", { name: /^Execution:/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(container.querySelector(".animate-spin")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Execution:/ }));
    expect(screen.getByText("Check the evidence first.")).toBeVisible();
  });

  it("keeps a tool-only trace without a fabricated reasoning section", () => {
    const { container } = render(
      <ThinkingAccordion
        content=""
        isThinking
        steps={[{ id: "call", label: "lookup records", status: "running" }]}
      />,
    );
    expect(
      container.querySelector("[data-execution-trace]"),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-model-reasoning]")).toBeNull();
  });

  it("keeps a running user's collapsed choice when new reasoning arrives", () => {
    const { rerender } = render(
      <ThinkingAccordion content="First part" isThinking />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Execution:/ }));
    rerender(
      <ThinkingAccordion
        content="First part, then more reasoning"
        isThinking
      />,
    );
    expect(screen.getByRole("button", { name: /^Execution:/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("measures only the current run and freezes the duration after completion", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(10000);
      const { container, rerender, unmount } = render(
        <ThinkingAccordion content="Evidence" isThinking startedAt={10000} />,
      );
      act(() => vi.advanceTimersByTime(3000));
      expect(
        container.querySelector("[data-execution-duration]"),
      ).toHaveTextContent("3 sec");
      rerender(<ThinkingAccordion content="Evidence" durationMs={3000} />);
      act(() => vi.advanceTimersByTime(10000));
      expect(
        container.querySelector("[data-execution-duration]"),
      ).toHaveTextContent("3 sec");
      expect(container.querySelector(".animate-spin")).toBeNull();
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not invent a duration or a running state when rendering old reasoning", () => {
    const { container } = render(
      <ThinkingAccordion content="Saved reasoning" />,
    );
    expect(container.querySelector("[data-execution-duration]")).toBeNull();
    expect(container.querySelector(".animate-spin")).toBeNull();
    expect(screen.getByRole("button", { name: /^Execution:/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("updates and settles a cached non-final execution message without remounting", () => {
    const CachedAssistant = memo(ThinkingAssistantMessage);
    const message = {
      id: "dingent-run-progress-cached-thread",
      role: "assistant" as const,
      content: "<thinking>Using tool: direct index status</thinking>",
    };
    const progress: RunProgressState = {
      messageId: message.id,
      thinkingText: "Using tool: direct index status",
      isThinking: true,
      runHasEnded: false,
      executionFailed: false,
      executionSteps: [
        {
          id: "cached-call",
          label: "Using tool: direct index status",
          status: "running",
        },
      ],
    };
    const view = (value: RunProgressState) => (
      <RunProgressContext.Provider value={value}>
        <CachedAssistant message={message} isRunning={true} />
      </RunProgressContext.Provider>
    );
    const { container, rerender } = render(view(progress));
    const completedTools: RunProgressState = {
      ...progress,
      executionSteps: progress.executionSteps.map((step) => ({
        ...step,
        status: "complete",
      })),
    };
    rerender(view(completedTools));
    expect(
      screen.getByRole("button", { name: "Execution: Working..." }),
    ).toHaveAttribute("aria-expanded", "true");
    rerender(view({ ...completedTools, isThinking: false, runHasEnded: true }));
    expect(
      screen.getByRole("button", { name: "Execution: Execution complete" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("renders thinking content separately and strips it from the assistant message", () => {
    render(
      <ThinkingAssistantMessage
        message={{
          id: "assistant-1",
          role: "assistant",
          content: "<thinking>check the route</thinking>Final answer",
        }}
        isRunning={true}
      />,
    );

    const toggle = screen.getByRole("button", { name: /^Execution:/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("check the route")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-message")).toHaveTextContent(
      "Final answer",
    );
    expect(screen.getByTestId("assistant-message")).not.toHaveTextContent(
      "thinking",
    );
  });

  it("falls back to the standard assistant renderer when there is no thinking block", () => {
    render(
      <ThinkingAssistantMessage
        message={{
          id: "assistant-2",
          role: "assistant",
          content: "Plain final answer",
        }}
        isRunning={false}
      />,
    );

    expect(screen.queryByText("Execution")).not.toBeInTheDocument();
    expect(screen.getByTestId("assistant-message")).toHaveTextContent(
      "Plain final answer",
    );
  });

  it("does not create an empty thinking panel for a model without reasoning", () => {
    render(
      <ThinkingAssistantMessage
        message={{
          id: "assistant-progress",
          role: "assistant",
          content: "<thinking></thinking>",
        }}
        isRunning={true}
      />,
    );

    expect(screen.queryByText("Working...")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("assistant-message")).not.toBeInTheDocument();
  });

  it("collapses a completed execution trace", () => {
    const { rerender } = render(
      <ThinkingAssistantMessage
        message={{
          id: "assistant-progress",
          role: "assistant",
          content: "<thinking>Using tool: search</thinking>",
        }}
        isRunning={true}
      />,
    );

    expect(screen.getByRole("button", { name: /^Execution:/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    rerender(
      <ThinkingAssistantMessage
        message={{
          id: "assistant-progress",
          role: "assistant",
          content: "<thinking>Using tool: search</thinking>",
        }}
        isRunning={false}
      />,
    );

    expect(screen.getByRole("button", { name: /^Execution:/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("Execution complete")).toBeInTheDocument();
  });

  it("groups repeated calls while preserving expandable call details", () => {
    const { container } = render(
      <ThinkingAccordion
        content="Compare the records before drawing conclusions."
        steps={[
          {
            id: "call-1",
            toolName: "search",
            label: "Search records",
            status: "complete",
            detail: "First result",
          },
          {
            id: "call-2",
            toolName: "search",
            label: "Search records",
            status: "complete",
            detail: "Second result",
          },
        ]}
      />,
    );
    expect(screen.queryByText("Search records")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Execution:/ }));
    expect(screen.getAllByText("Search records")).toHaveLength(1);
    expect(screen.getByText("2 calls")).toBeInTheDocument();
    expect(screen.getByText("First result")).toBeInTheDocument();
    expect(screen.getByText("Second result")).toBeInTheDocument();
    expect(
      screen.getByText("Compare the records before drawing conclusions."),
    ).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("highlights the current call without claiming unfinished calls succeeded", () => {
    const { container, rerender } = render(
      <ThinkingAccordion
        content=""
        isThinking
        steps={[{ id: "call-1", label: "Current lookup", status: "running" }]}
      />,
    );
    expect(screen.getAllByText("Current lookup")).toHaveLength(2);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    rerender(
      <ThinkingAccordion
        content=""
        steps={[{ id: "call-1", label: "Current lookup", status: "running" }]}
      />,
    );
    expect(container.querySelector(".animate-spin")).toBeNull();
    expect(screen.getByRole("button", { name: /^Execution:/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: /^Execution:/ }));
    expect(container.querySelector(".lucide-circle")).not.toBeNull();
  });

  it("shows a failed run without a misleading completed label or spinner", () => {
    const message = {
      id: "dingent-run-progress-thread-1",
      role: "assistant" as const,
      content: "<thinking></thinking>",
      executionFailed: true,
    } satisfies ExecutionTraceData & {
      id: string;
      role: "assistant";
      content: string;
    };
    const { container } = render(
      <ThinkingAssistantMessage message={message} isRunning={false} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Execution failed");
    expect(screen.queryByText("Execution complete")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("does not label a completed tool as running while the answer is streaming", () => {
    render(
      <ThinkingAccordion
        content=""
        isThinking
        steps={[
          {
            id: "call-1",
            label: "Using tool: direct index status",
            status: "complete",
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Execution: Working..." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Using tool: direct index status"),
    ).toBeInTheDocument();
  });

  it("shows a stopped run without calling it completed or failed", () => {
    const { container } = render(
      <ThinkingAssistantMessage
        message={
          {
            id: "dingent-run-progress-stopped",
            role: "assistant",
            content: "<thinking></thinking>",
            executionStopped: true,
            executionFailed: true,
          } as ExecutionTraceData & {
            id: string;
            role: "assistant";
            content: string;
          }
        }
        isRunning={false}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Execution stopped");
    expect(screen.queryByText("Execution complete")).not.toBeInTheDocument();
    expect(screen.queryByText("Execution failed")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });
});
