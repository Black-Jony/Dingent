"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getClientApi } from "@/lib/api/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

export function useAssistants(workspaceSlug: string) {
  const t = useTranslations("Assistants");
  const qc = useQueryClient();
  const api = getClientApi();
  const wsApi = api.forWorkspace(workspaceSlug);

  // Queries
  const assistantsQuery = useQuery({
    queryKey: ["assistants", workspaceSlug],
    queryFn: async () => (await wsApi.assistants.list()) ?? [],
    staleTime: 5_000,
  });

  const pluginsQuery = useQuery({
    queryKey: ["available-plugins", workspaceSlug],
    queryFn: async () => (await wsApi.plugins.list()) ?? [],
    staleTime: 30_000,
  });

  const modelsQuery = useQuery({
    queryKey: ["models", workspaceSlug],
    queryFn: async () => (await wsApi.models.list()) ?? [],
    staleTime: 30_000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      wsApi.assistants.create(data),
    onSuccess: () => {
      toast.success(t("toastAdded"));
      qc.invalidateQueries({ queryKey: ["assistants"] });
    },
    onError: (e) => toast.error(getErrorMessage(e, t("toastAddFailed"))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wsApi.assistants.delete(id),
    onSuccess: () => {
      toast.success(t("toastDeleted"));
      qc.invalidateQueries({ queryKey: ["assistants"] });
    },
    onError: (e) => toast.error(getErrorMessage(e, t("toastDeleteFailed"))),
  });

  const updateBatchMutation = useMutation({
    mutationFn: async (assistants: any[]) => {
      await Promise.all(
        assistants.map((a) => wsApi.assistants.update(a.id, a)),
      );
    },
    onSuccess: () => {
      toast.success(t("toastSaved"));
      qc.invalidateQueries({ queryKey: ["assistants"] });
    },
    onError: (e) => toast.error(getErrorMessage(e, t("toastSaveFailed"))),
  });

  const addPluginMutation = useMutation({
    mutationFn: (p: { assistantId: string; pluginId: string }) =>
      wsApi.assistants.addPlugin(p.assistantId, p.pluginId),
    onSuccess: () => {
      toast.success(t("toastPluginAdded"));
      qc.invalidateQueries({ queryKey: ["assistants"] });
    },
    onError: (e) => toast.error(getErrorMessage(e, t("toastPluginAddFailed"))),
  });

  const removePluginMutation = useMutation({
    mutationFn: (p: { assistantId: string; pluginId: string }) =>
      wsApi.assistants.removePlugin(p.assistantId, p.pluginId),
    onSuccess: () => {
      toast.success(t("toastPluginRemoved"));
      qc.invalidateQueries({ queryKey: ["assistants"] });
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, t("toastPluginRemoveFailed"))),
  });

  return {
    assistantsQuery,
    pluginsQuery,
    modelsQuery,
    createMutation,
    deleteMutation,
    updateBatchMutation,
    addPluginMutation,
    removePluginMutation,
  };
}
