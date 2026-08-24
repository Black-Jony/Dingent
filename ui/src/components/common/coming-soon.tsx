"use client";

import { useTranslations } from "next-intl";
import { Telescope } from "lucide-react";

export function ComingSoon() {
  const t = useTranslations("Common");

  return (
    <div className="h-svh">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <Telescope size={72} />
        <h1 className="text-4xl leading-tight font-bold">{t("comingSoon")}</h1>
        <p className="text-muted-foreground text-center">
          {t("comingSoonDescription")}
        </p>
      </div>
    </div>
  );
}
