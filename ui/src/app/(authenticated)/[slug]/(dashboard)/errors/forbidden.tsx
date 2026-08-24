"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ForbiddenError() {
  const t = useTranslations("Errors");
  const common = useTranslations("Common");
  const router = useRouter();

  return (
    <div className="h-svh">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <h1 className="text-[7rem] leading-tight font-bold">403</h1>
        <span className="font-medium">{t("forbidden")}</span>
        <p className="text-muted-foreground text-center">
          {t("forbiddenDescription")}
        </p>
        <div className="mt-6 flex gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            {common("goBack")}
          </Button>
          <Button onClick={() => router.push("/")}>{t("backHome")}</Button>
        </div>
      </div>
    </div>
  );
}
