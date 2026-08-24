"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Edit2, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import type {
  LLMModelConfig,
  LLMModelConfigUpdate,
  TestConnectionRequest,
  TestConnectionResponse,
} from "@/types/entity";
import { ModelConfigDialog } from "./model-config-dialog";

interface ModelsTableProps {
  models: LLMModelConfig[];
  onEdit: (id: string, data: LLMModelConfigUpdate) => void;
  onDelete: (id: string) => void;
  onTestConnection?: (
    data: TestConnectionRequest,
  ) => Promise<TestConnectionResponse>;
  isUpdating: boolean;
  isDeleting: boolean;
  deletingId?: string;
}

export function ModelsTable({
  models,
  onEdit,
  onDelete,
  onTestConnection,
  isUpdating,
  isDeleting,
  deletingId,
}: ModelsTableProps) {
  const t = useTranslations("Models");
  const common = useTranslations("Common");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setModelToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (modelToDelete) {
      onDelete(modelToDelete);
    }
    setDeleteDialogOpen(false);
    setModelToDelete(null);
  };

  if (models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">{t("empty")}</p>
        <p className="text-sm text-muted-foreground">{t("emptyHelp")}</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{common("name")}</TableHead>
            <TableHead>{t("provider")}</TableHead>
            <TableHead>{t("model")}</TableHead>
            <TableHead>{t("apiBase")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("apiKey")}</TableHead>
            <TableHead className="text-right">{common("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((model) => (
            <TableRow key={model.id}>
              <TableCell className="font-medium">{model.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{model.provider}</Badge>
              </TableCell>
              <TableCell>{model.model}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {model.api_base || "-"}
              </TableCell>
              <TableCell>
                {model.is_active ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {common("active")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    {common("inactive")}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {model.has_api_key ? (
                  <Badge variant="outline">{t("configured")}</Badge>
                ) : (
                  <Badge variant="secondary">{t("notSet")}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <ModelConfigDialog
                    model={model}
                    isPending={isUpdating}
                    onSave={(data) => onEdit(model.id, data)}
                    onTestConnection={onTestConnection}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(model.id)}
                    disabled={isDeleting && deletingId === model.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              {common("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
