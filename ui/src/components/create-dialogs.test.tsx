import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateAssistantDialog } from "@/features/assistants/components/create-dialog";
import { NewWorkflowDialog } from "@/features/workflows/components/workflows/NewWorkflowDialog";

afterEach(cleanup);
describe("creation failure preserves drafts", () => {
  it("keeps a failed assistant creation open", async () => {
    render(
      <CreateAssistantDialog
        isPending={false}
        onCreate={vi.fn().mockRejectedValue(new Error("Create failed"))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Assistant" }));
    fireEvent.change((await screen.findAllByRole("textbox"))[0], {
      target: { value: "Draft assistant" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Create failed"),
    );
    expect(screen.getByDisplayValue("Draft assistant")).toBeVisible();
  });
  it("keeps a failed workflow creation open", async () => {
    render(
      <NewWorkflowDialog
        onCreateWorkflow={vi.fn().mockRejectedValue(new Error("Create failed"))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "New Workflow" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Draft workflow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Create failed"),
    );
    expect(screen.getByDisplayValue("Draft workflow")).toBeVisible();
  });
});
