import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAssistantEditor } from "./use-assistant-editor";
import type { Assistant } from "@/types/entity";

describe("assistant drafts", () => {
  const initial: Assistant = {
    id: "assistant-1",
    name: "Original",
    description: "Old",
    plugins: [],
  };

  it("preserves edits on refetch while accepting server-owned plugin changes", async () => {
    const { result, rerender } = renderHook(
      ({ data }) => useAssistantEditor(data, "alpha"),
      { initialProps: { data: [initial] } },
    );
    await waitFor(() => expect(result.current.editable).toHaveLength(1));
    act(() => result.current.updateAssistant(0, { ...initial, name: "Draft" }));
    rerender({
      data: [
        {
          ...initial,
          description: "Refreshed",
          plugins: [{ registry_id: "new-plugin", display_name: "New plugin" }],
        },
      ],
    });
    await waitFor(() => expect(result.current.editable[0].name).toBe("Draft"));
    expect(result.current.editable[0].description).toBe("Refreshed");
    expect(result.current.editable[0].plugins).toHaveLength(1);
    expect(result.current.hasChanges).toBe(true);
  });

  it("does not mark newer edits as saved when an earlier save finishes", async () => {
    const data = [initial];
    const { result } = renderHook(() => useAssistantEditor(data));
    await waitFor(() => expect(result.current.editable).toHaveLength(1));
    act(() =>
      result.current.updateAssistant(0, { ...initial, name: "First draft" }),
    );
    const saved = result.current.getDirtyAssistants();
    act(() =>
      result.current.updateAssistant(0, { ...initial, name: "Newer draft" }),
    );
    act(() => result.current.markSaved(saved));
    expect(result.current.hasChanges).toBe(true);
    const latest = result.current.getDirtyAssistants();
    act(() => result.current.markSaved(latest));
    expect(result.current.hasChanges).toBe(false);
  });

  it("resets drafts when the workspace changes", async () => {
    const { result, rerender } = renderHook(
      ({ scope, data }) => useAssistantEditor(data, scope),
      { initialProps: { scope: "alpha", data: [initial] } },
    );
    act(() => result.current.updateAssistant(0, { ...initial, name: "Draft" }));
    rerender({
      scope: "beta",
      data: [{ ...initial, name: "Other workspace" }],
    });
    await waitFor(() =>
      expect(result.current.editable[0].name).toBe("Other workspace"),
    );
    expect(result.current.hasChanges).toBe(false);
  });
});
