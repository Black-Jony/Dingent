import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThinkingCursor } from "./ThinkingCursor";
import { RunProgressContext, type RunProgressState } from "./ThinkingAccordion";

const waiting: RunProgressState = {
  messageId: "dingent-run-progress-thread",
  thinkingText: "",
  isThinking: true,
  runHasEnded: false,
  executionSteps: [],
  executionFailed: false,
  executionStartedAt: 1000,
};

function Cursor({ progress }: { progress: RunProgressState | null }) {
  return (
    <RunProgressContext.Provider value={progress}>
      <ThinkingCursor />
    </RunProgressContext.Provider>
  );
}

describe("ThinkingCursor", () => {
  it("shows an accessible spinner aligned with the answer column while waiting", () => {
    const { rerender } = render(<Cursor progress={waiting} />);
    expect(screen.getByRole("status")).toHaveTextContent("Working...");
    expect(screen.getByRole("status")).toHaveClass("mx-auto", "max-w-3xl");
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass(
      "animate-spin",
      "motion-reduce:animate-none",
    );
    // Reasoning can finish before the answer's text stream does.
    rerender(<Cursor progress={{ ...waiting, isThinking: false }} />);
    expect(screen.getByRole("status")).toBeVisible();
    rerender(<Cursor progress={{ ...waiting, runHasEnded: true }} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([
    null,
    { ...waiting, executionStartedAt: undefined },
    { ...waiting, executionFailed: true },
    { ...waiting, executionStopped: true },
    { ...waiting, thinkingText: "Actual model reasoning" },
    {
      ...waiting,
      executionSteps: [
        { id: "tool", label: "Search", status: "running" as const },
      ],
    },
  ])(
    "hides when idle, settled, or a real trace already shows progress (%#)",
    (progress) => {
      render(<Cursor progress={progress} />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );
});
