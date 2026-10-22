import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createA2UIMessageRenderer } from "./MyA2UIMessageRenderer";
import {
  AnalysisWorkspaceProvider,
  AnalysisWorkspaceSlot,
} from "@/features/chat/shared/AnalysisWorkspace";

vi.mock("@copilotkit/a2ui-renderer", () => ({
  A2UIProvider: ({ children }: { children: React.ReactNode }) => children,
  A2UIRenderer: () => null,
  useA2UIActions: () => ({ processMessages: vi.fn() }),
}));
afterEach(cleanup);

it("retains real table pagination and sorting while opening and closing the analysis panel", () => {
  const Render = createA2UIMessageRenderer({}).render;
  render(
    <AnalysisWorkspaceProvider>
      <Render
        activityType="a2ui-surface"
        content={{
          type: "table",
          title: "Records",
          columns: ["name"],
          rows: Array.from({ length: 45 }, (_, i) => ({
            name: `Row ${String(i + 1).padStart(2, "0")}`,
          })),
        }}
        message={{ id: "table-state" }}
        agent={{}}
      />
      <AnalysisWorkspaceSlot />
    </AnalysisWorkspaceProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "name" }));
  fireEvent.click(screen.getByRole("button", { name: "name" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Row 25", { exact: true })).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Open in analysis workspace" }),
  );
  const panel = screen.getByRole("complementary", { name: "Records" });
  expect(within(panel).getByText("Row 25", { exact: true })).toBeVisible();
  expect(
    within(panel).queryByText("Row 45", { exact: true }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(panel).getByRole("button", { name: "Close analysis workspace" }),
  );
  expect(screen.getByText("Row 25", { exact: true })).toBeVisible();
  expect(screen.getAllByRole("table")).toHaveLength(1);
});
