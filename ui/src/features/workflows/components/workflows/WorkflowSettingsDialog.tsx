"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModelSelector } from "@/components/common/model-selector";
import type { Workflow, LLMModelConfig } from "@/types/entity";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WorkflowSettingsDialogProps {
  workflow: Workflow;
  models: LLMModelConfig[];
  onSave: (updates: {
    name?: string;
    description?: string;
    model_config_id?: string | null;
  }) => Promise<unknown>;
  isSaving: boolean;
}

export function WorkflowSettingsDialog({
  workflow,
  models,
  onSave,
  isSaving,
}: WorkflowSettingsDialogProps) {
  const t = useTranslations("Workflows");
  const common = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const initializedId = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description || "");
  const [modelConfigId, setModelConfigId] = useState<string | null>(
    workflow.model_config_id || null,
  );

  useEffect(() => {
    if (!open) initializedId.current = null;
    if (open && initializedId.current !== workflow.id) {
      initializedId.current = workflow.id;
      setName(workflow.name);
      setDescription(workflow.description || "");
      setModelConfigId(workflow.model_config_id || null);
      setSaveError(null);
    }
  }, [open, workflow]);

  const handleSave = async () => {
    if (isSaving || pending || !name.trim()) return;
    setPending(true);
    setSaveError(null);
    try {
      await onSave({
        name: name.trim(),
        description,
        model_config_id: modelConfigId,
      });
      setOpen(false);
    } catch (error) {
      setSaveError(getErrorMessage(error, t("updateFailed")));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending && !isSaving) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-1"
          aria-label={t("settings")}
          title={t("settings")}
        >
          <Settings size={14} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("settings")}</DialogTitle>
        </DialogHeader>
        <fieldset
          disabled={pending || isSaving}
          className="min-w-0 space-y-4 py-4"
        >
          <div className="space-y-2">
            <Label htmlFor="workflow-name">{t("workflowName")}</Label>
            <Input
              id="workflow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workflowNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workflow-description">
              {common("description")}
            </Label>
            <Textarea
              id="workflow-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workflow-model">{t("modelConfiguration")}</Label>
            <p className="text-sm text-muted-foreground mb-2">
              {t("modelHelp")}
            </p>
            <ModelSelector
              models={models}
              value={modelConfigId}
              onChange={setModelConfigId}
              placeholder={t("useWorkspaceDefault")}
              allowClear={true}
            />
          </div>
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={pending || isSaving}
            onClick={() => setOpen(false)}
          >
            {common("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={pending || isSaving || !name.trim()}
          >
            {pending || isSaving ? common("saving") : common("saveChanges")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
