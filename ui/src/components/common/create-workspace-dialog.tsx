"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { WorkspaceApi } from "@/services/workspace";

type CreateWorkspaceValues = { name: string; slug: string };

interface CreateWorkspaceDialogProps {
  api: WorkspaceApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceDialog({
  api,
  open,
  onOpenChange,
}: CreateWorkspaceDialogProps) {
  const t = useTranslations("Workspace");
  const common = useTranslations("Common");
  const [isLoading, setIsLoading] = useState(false);
  const formSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t("validation.nameRequired"))
          .max(50, t("validation.nameTooLong")),
        slug: z
          .string()
          .min(3, t("validation.slugMin"))
          .max(30, t("validation.slugMax"))
          .regex(/^[a-z0-9-]+$/, t("validation.slugPattern")),
      }),
    [t],
  );
  const form = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", slug: "" },
  });

  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  async function onSubmit(data: CreateWorkspaceValues) {
    setIsLoading(true);
    const createPromise = api.create({ name: data.name, slug: data.slug });
    toast.promise(createPromise, {
      loading: t("toast.creating"),
      success: (workspace) => {
        setIsLoading(false);
        onOpenChange(false);
        return t("toast.created", { name: workspace.name });
      },
      error: (error) => {
        setIsLoading(false);
        if (error.message?.includes("slug")) {
          form.setError("slug", { message: t("validation.slugTaken") });
        }
        return error.message || t("toast.failed");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("namePlaceholder")}
                      {...field}
                      onChange={(event) => {
                        field.onChange(event);
                        if (!form.getValues("slug")) {
                          form.setValue(
                            "slug",
                            event.target.value
                              .toLowerCase()
                              .replace(/\s+/g, "-")
                              .replace(/[^a-z0-9-]/g, ""),
                          );
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("slug")}</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-2 text-sm">
                        app.com/
                      </span>
                      <Input placeholder="acme-corp" {...field} />
                    </div>
                  </FormControl>
                  <FormDescription>{t("slugHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                {common("cancel")}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {common("create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
