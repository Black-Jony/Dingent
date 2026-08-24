"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CreateAssistantDialogProps {
  isPending: boolean;
  onCreate: (data: { name: string; description: string }) => void;
}

export function CreateAssistantDialog({
  isPending,
  onCreate,
}: CreateAssistantDialogProps) {
  const t = useTranslations("Assistants");
  const common = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ name: "", description: "" });

  const handleSubmit = () => {
    onCreate(data);
    setOpen(false);
    setData({ name: "", description: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" /> {t("addAssistant")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addNew")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("nameRequired")}</Label>
            <Input
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder={t("namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{common("description")}</Label>
            <Textarea
              value={data.description}
              onChange={(e) =>
                setData({ ...data, description: e.target.value })
              }
              placeholder={t("descriptionPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            {isPending ? common("adding") : common("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
