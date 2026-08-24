"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type GeneralErrorProps = React.HTMLAttributes<HTMLDivElement> & {
  minimal?: boolean;
};

export function GeneralError({
  className,
  minimal = false,
}: GeneralErrorProps) {
  const t = useTranslations("Errors");
  const common = useTranslations("Common");
  const router = useRouter();

  return (
    <div className={cn("h-svh w-full", className)}>
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        {!minimal && (
          <h1 className="text-[7rem] leading-tight font-bold">500</h1>
        )}
        <span className="font-medium">{t("general")}</span>
        <p className="text-muted-foreground text-center">
          {t("generalDescription")}
        </p>
        {!minimal && (
          <div className="mt-6 flex gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              {common("goBack")}
            </Button>
            <Button onClick={() => router.push("/")}>{t("backHome")}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
