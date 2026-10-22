import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface WorkflowState {
  activeIds: Record<string, string | null>;
  legacyActiveId: string | null;
  setActiveId: (workspaceId: string, id: string | null) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      activeIds: {},
      legacyActiveId: null,
      setActiveId: (workspaceId, id) =>
        set((state) => ({
          activeIds: { ...state.activeIds, [workspaceId]: id },
          legacyActiveId:
            state.legacyActiveId === id ? null : state.legacyActiveId,
        })),
    }),
    {
      name: "active-workflow-id", // LocalStorage key
      version: 1,
      migrate: (persisted) => {
        const previous = persisted as { activeId?: unknown } | undefined;
        return {
          activeIds: {},
          legacyActiveId:
            typeof previous?.activeId === "string" ? previous.activeId : null,
        };
      },
      storage: createJSONStorage(() => localStorage), // 自动处理 SSR/Window check
      // 自动处理跨 Tab 同步 (storage 事件)
    },
  ),
);
