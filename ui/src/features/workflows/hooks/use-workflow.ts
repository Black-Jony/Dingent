import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Workflow } from "@/types/entity";
import { useWorkflowStore } from "@/store/workflow";
import { AssistantsApi, WorkflowsApi } from "@/services/dashboard";

export const workflowKeys = {
  all: ["workflows"] as const,
  lists: (workspaceId: string | undefined) =>
    [...workflowKeys.all, "list", workspaceId] as const,
  details: () => [...workflowKeys.all, "detail"] as const,
  detail: (workspaceId: string | undefined, id: string | null) =>
    [...workflowKeys.details(), workspaceId, id] as const,
  assistants: (workspaceId: string | undefined) =>
    [...workflowKeys.all, "assistants", workspaceId] as const,
};

export function useWorkflowsList(
  api: WorkflowsApi,
  workspaceId: string | undefined,
) {
  return useQuery({
    queryKey: workflowKeys.lists(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () => (await api.list()) ?? [],
  });
}

export function useWorkflow(
  api: WorkflowsApi,
  id: string | null,
  workspaceId?: string,
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: workflowKeys.detail(workspaceId, id),
    enabled: !!id && !!workspaceId,
    queryFn: async () => api.get(id!),
    placeholderData: () => {
      if (!workspaceId) return undefined;
      const list = queryClient.getQueryData<Workflow[]>(
        workflowKeys.lists(workspaceId),
      );
      return list?.find((w) => w.id === id);
    },
  });
}

export function useAssistantsConfig(
  api: AssistantsApi,
  workspaceId: string | undefined,
) {
  return useQuery({
    queryKey: workflowKeys.assistants(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () => (await api.list()) ?? [],
  });
}

export function useActiveWorkflow(
  api: WorkflowsApi,
  workspaceId: string | undefined,
) {
  const {
    activeIds,
    legacyActiveId,
    setActiveId: updateActiveId,
  } = useWorkflowStore();
  const { data: workflows } = useWorkflowsList(api, workspaceId);
  const selectedId = workspaceId ? (activeIds[workspaceId] ?? null) : null;
  const legacyId =
    !selectedId &&
    legacyActiveId &&
    workflows?.some((workflow) => workflow.id === legacyActiveId)
      ? legacyActiveId
      : null;
  const activeId =
    workflows && !workflows.some((workflow) => workflow.id === selectedId)
      ? legacyId
      : (selectedId ?? legacyId);
  const setActiveId = useCallback(
    (id: string | null) => {
      if (workspaceId) updateActiveId(workspaceId, id);
    },
    [workspaceId, updateActiveId],
  );
  useEffect(() => {
    if (!workspaceId || !workflows) return;
    if (legacyId || (selectedId && activeId !== selectedId))
      setActiveId(activeId);
  }, [workspaceId, workflows, selectedId, legacyId, activeId, setActiveId]);

  const {
    data: workflow,
    isLoading,
    isError,
  } = useWorkflow(api, activeId, workspaceId);

  return {
    id: activeId,
    workflow,
    isLoading,
    isError,
    setActiveId,
    name: workflow?.name || "Untitled",
  };
}

/** Apply a workflow name supplied by an external chat URL. */
export function useApplyWorkflowFromUrl(
  api: WorkflowsApi,
  workspaceId: string | undefined,
) {
  const workflowName = useSearchParams().get("workflow")?.trim();
  const { data: workflows } = useWorkflowsList(api, workspaceId);
  const { setActiveId } = useWorkflowStore();

  useEffect(() => {
    if (!workflowName || !workflows?.length) return;

    const matchedWorkflow = workflows.find(
      (workflow) => workflow.name.toLowerCase() === workflowName.toLowerCase(),
    );
    if (matchedWorkflow) {
      if (workspaceId) setActiveId(workspaceId, matchedWorkflow.id);
    }
  }, [workflowName, workflows, setActiveId, workspaceId]);
}

// --- Mutations ---

export function useCreateWorkflow(
  api: WorkflowsApi,
  workspaceId: string | undefined,
) {
  const queryClient = useQueryClient();
  const { setActiveId } = useWorkflowStore();

  return useMutation({
    mutationFn: ({
      name,
      description,
    }: {
      name: string;
      description?: string;
    }) => {
      if (!workspaceId) throw new Error("No workspace selected");
      return api.create({ name, description });
    },
    onSuccess: (newWf: Workflow) => {
      // 1. 仅使得当前 Workspace 的列表过期
      queryClient.invalidateQueries({
        queryKey: workflowKeys.lists(workspaceId),
      });

      // 2. 写入详情缓存
      queryClient.setQueryData(
        workflowKeys.detail(workspaceId, newWf.id),
        newWf,
      );

      // 3. 自动设为当前选中
      if (workspaceId) setActiveId(workspaceId, newWf.id);
    },
  });
}

export function useSaveWorkflow(
  api: WorkflowsApi,
  workspaceId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Workflow) => api.update(data),
    onSuccess: (savedWf) => {
      // 更新当前 Workspace 的列表缓存（例如名称变更）
      queryClient.invalidateQueries({
        queryKey: workflowKeys.lists(workspaceId),
      });

      if (savedWf?.id) {
        queryClient.invalidateQueries({
          queryKey: workflowKeys.detail(workspaceId, savedWf.id),
        });
      }
    },
  });
}

export function useDeleteWorkflow(
  api: WorkflowsApi,
  workspaceId: string | undefined,
) {
  const queryClient = useQueryClient();
  const { setActiveId } = useWorkflowStore();

  return useMutation({
    mutationFn: (id: string) => api.delete(id),
    onSuccess: (_ok, deletedId) => {
      // 更新当前 Workspace 的列表
      queryClient.invalidateQueries({
        queryKey: workflowKeys.lists(workspaceId),
      });
      queryClient.removeQueries({
        queryKey: workflowKeys.detail(workspaceId, deletedId),
      });

      if (
        workspaceId &&
        useWorkflowStore.getState().activeIds[workspaceId] === deletedId
      ) {
        setActiveId(workspaceId, null);
      }
    },
  });
}
