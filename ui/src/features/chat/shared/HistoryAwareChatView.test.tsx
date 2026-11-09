import { render, screen } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CopilotChatViewProps } from "@copilotkit/react-core/v2";
import {
  HistoryAwareChatView,
  HistoryLoadingContext,
} from "./HistoryAwareChatView";

let viewProps: CopilotChatViewProps;

vi.mock("@copilotkit/react-core/v2", () => ({
  CopilotChatView: (props: CopilotChatViewProps) => {
    viewProps = props;
    return <LoadingState />;
  },
}));

function LoadingState() {
  return (
    <div data-testid="loading-state">
      {String(useContext(HistoryLoadingContext))}
    </div>
  );
}

describe("HistoryAwareChatView", () => {
  it("separates history loading from execution and blocks submission until replay finishes", () => {
    const submit = vi.fn();
    const selectSuggestion = vi.fn();
    const { rerender } = render(
      <HistoryAwareChatView
        isConnecting
        isRunning
        onSubmitMessage={submit}
        onSelectSuggestion={selectSuggestion}
      />,
    );
    expect(viewProps.isRunning).toBe(false);
    expect(viewProps.onSubmitMessage).toBeUndefined();
    expect(viewProps.onSelectSuggestion).toBeUndefined();
    expect(screen.getByTestId("loading-state")).toHaveTextContent("true");

    rerender(
      <HistoryAwareChatView
        isConnecting={false}
        isRunning={false}
        onSubmitMessage={submit}
        onSelectSuggestion={selectSuggestion}
      />,
    );
    expect(viewProps.isRunning).toBe(false);
    expect(viewProps.onSubmitMessage).toBe(submit);
    expect(viewProps.onSelectSuggestion).toBe(selectSuggestion);
    expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
  });

  it("preserves running and stop behavior for actual model execution", () => {
    const stop = vi.fn();
    render(
      <HistoryAwareChatView isConnecting={false} isRunning onStop={stop} />,
    );
    expect(viewProps.isRunning).toBe(true);
    expect(viewProps.onStop).toBe(stop);
  });
});
