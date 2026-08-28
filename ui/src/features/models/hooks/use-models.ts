"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getClientApi } from "@/lib/api/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import type {
  LLMModelConfigCreate,
  LLMModelConfigUpdate,
  TestConnectionRequest,
} from "@/types/entity";

export function useModels(workspaceSlug: string) {
  const t = useTranslations("Models");
  const qc = useQueryClient();
  const api = getClientApi();
  const wsApi = api.forWorkspace(workspaceSlug);

  // Queries
  const modelsQuery = useQuery({
    queryKey: ["models", workspaceSlug],
    queryFn: async () => (await wsApi.models.list()) ?? [],
    staleTime: 5_000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: LLMModelConfigCreate) => wsApi.models.create(data),
    onSuccess: () => {
      toast.success(t("addSuccess"));
      qc.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (e) => toast.error(getErrorMessage(e, t("addFailed"))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LLMModelConfigUpdate }) =>
      wsApi.models.update(id, data),
    onSuccess: () => {
      toast.success(t("updateSuccess"));
      qc.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (e) => toast.error(getErrorMessage(e, t("updateFailed"))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wsApi.models.delete(id),
    onSuccess: () => {
      toast.success(t("deleteSuccess"));
      qc.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (e) => toast.error(getErrorMessage(e, t("deleteFailed"))),
  });

  const testConnectionMutation = useMutation({
    mutationFn: (data: TestConnectionRequest) =>
      wsApi.models.testConnection(data),
    onError: (e) => toast.error(getErrorMessage(e, t("testFailed"))),
  });

  return {
    modelsQuery,
    createMutation,
    updateMutation,
    deleteMutation,
    testConnectionMutation,
  };
}
