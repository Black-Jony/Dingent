"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Dialog,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getErrorMessage } from "@/lib/utils";
type CreateWorkflowVars = {
  name: string;
  description?: string;
};
export function NewWorkflowDialog({
  onCreateWorkflow,
}: {
  onCreateWorkflow: (vars: CreateWorkflowVars) => Promise<unknown>;
}) {
  const t = useTranslations("Workflows");
  const common = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && !pending) {
      setPending(true);
      setError(null);
      try {
        await onCreateWorkflow({
          name: name.trim(),
          description: description.trim() || undefined,
        });
        setName("");
        setDescription("");
        setOpen(false);
      } catch (error) {
        setError(
          getErrorMessage(error, t("createFailed", { error: common("error") })),
        );
      } finally {
        setPending(false);
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus size={16} />
          {t("newWorkflow")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createNew")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("workflowName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("workflowNamePlaceholder")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("descriptionOptional")}</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
              />
            </div>
          </fieldset>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {common("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? common("saving") : common("create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
