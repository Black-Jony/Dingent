import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelConfigDialog } from "./model-config-dialog";
import type { LLMModelConfig, TestConnectionResponse } from "@/types/entity";

afterEach(cleanup);

async function openForm(
  onSave = vi.fn().mockResolvedValue({}),
  onTestConnection?: () => Promise<TestConnectionResponse>,
) {
  render(
    <ModelConfigDialog
      isPending={false}
      onSave={onSave}
      onTestConnection={onTestConnection}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add Model" }));
  const fields = await screen.findAllByRole("textbox");
  fireEvent.change(fields[0], { target: { value: "My model" } });
  fireEvent.change(fields[1], { target: { value: "model-id" } });
  return { onSave, fields };
}

describe("model configuration safety", () => {
  for (const value of ["[]", "null", "true", "12", '"text"']) {
    it(`rejects non-object parameters: ${value}`, async () => {
      const { onSave, fields } = await openForm();
      fireEvent.change(fields.at(-1)!, { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(screen.getByText(/invalid json/i)).toBeVisible();
    });
  }

  it("keeps a failed save open and preserves entered values", async () => {
    await openForm(vi.fn().mockRejectedValue(new Error("Save rejected")));
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    await waitFor(() =>
      expect(screen.getByText("Save rejected")).toBeVisible(),
    );
    expect(screen.getByDisplayValue("My model")).toBeVisible();
  });

  it("closes only after a successful save", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    await openForm(vi.fn().mockReturnValue(pending));
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    expect(screen.getByRole("dialog")).toBeVisible();
    await act(async () => finish());
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("ignores connection results for a configuration that has changed", async () => {
    let finish!: (result: TestConnectionResponse) => void;
    const pending = new Promise<TestConnectionResponse>((resolve) => {
      finish = resolve;
    });
    const { fields } = await openForm(undefined, () => pending);
    fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));
    fireEvent.change(fields[1], { target: { value: "different-model" } });
    await act(async () =>
      finish({ success: true, message: "Obsolete success", latency_ms: 1 }),
    );
    expect(screen.queryByText("Obsolete success")).not.toBeInTheDocument();
  });

  it("does not overwrite an open draft on background model refetch", async () => {
    const model = {
      id: "model-1",
      name: "Original",
      provider: "openai",
      model: "model-id",
      parameters: {},
      is_active: true,
    } as LLMModelConfig;
    const view = render(
      <ModelConfigDialog model={model} isPending={false} onSave={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Model" }));
    fireEvent.change((await screen.findAllByRole("textbox"))[0], {
      target: { value: "Unsaved" },
    });
    view.rerender(
      <ModelConfigDialog
        model={{ ...model, name: "Refetched" }}
        isPending={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Unsaved")).toBeVisible();
  });
});
