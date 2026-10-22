"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { getClientApi } from "@/lib/api/client";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { Button } from "../ui/button";

export function WorkspaceEntry() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("Workspace");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">{t("createTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("createDescription")}</p>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("createTitle")}
      </Button>
      <CreateWorkspaceDialog
        api={getClientApi().workspaces}
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) router.refresh();
        }}
      />
    </main>
  );
}
