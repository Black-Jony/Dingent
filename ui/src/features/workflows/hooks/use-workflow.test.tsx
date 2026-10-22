import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useActiveWorkflow, useWorkflow } from "./use-workflow";
import { useWorkflowStore } from "@/store/workflow";
import type { WorkflowsApi } from "@/services/dashboard";

afterEach(() => {
  cleanup();
  useWorkflowStore.setState({ activeIds: {}, legacyActiveId: null });
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("workspace-scoped workflow state", () => {
  it("does not reuse another workspace's workflow or detail cache", async () => {
    const apiA = {
      get: vi.fn().mockResolvedValue({ id: "same-id", name: "A" }),
    } as unknown as WorkflowsApi;
    const apiB = {
      get: vi.fn().mockResolvedValue({ id: "same-id", name: "B" }),
    } as unknown as WorkflowsApi;
    const { result, rerender } = renderHook(
      ({ api, scope }) => useWorkflow(api, "same-id", scope),
      { wrapper: createWrapper(), initialProps: { api: apiA, scope: "alpha" } },
    );
    await waitFor(() => expect(result.current.data?.name).toBe("A"));
    rerender({ api: apiB, scope: "beta" });
    expect(result.current.data?.name).not.toBe("A");
    await waitFor(() => expect(result.current.data?.name).toBe("B"));
  });

  it("migrates a legacy selection only into the workspace that owns it", async () => {
    useWorkflowStore.setState({ activeIds: {}, legacyActiveId: "legacy" });
    const api = {
      list: vi.fn().mockResolvedValue([{ id: "legacy", name: "A" }]),
      get: vi.fn().mockResolvedValue({ id: "legacy", name: "A" }),
    } as unknown as WorkflowsApi;
    const { result, rerender } = renderHook(
      ({ scope }) => useActiveWorkflow(api, scope),
      { wrapper: createWrapper(), initialProps: { scope: "alpha" } },
    );
    await waitFor(() => expect(result.current.id).toBe("legacy"));
    expect(useWorkflowStore.getState().activeIds.alpha).toBe("legacy");
    rerender({ scope: "beta" });
    expect(result.current.id).toBeNull();
    act(() => result.current.setActiveId("other"));
    expect(useWorkflowStore.getState().activeIds.alpha).toBe("legacy");
    expect(useWorkflowStore.getState().activeIds.beta).toBe("other");
  });
});
