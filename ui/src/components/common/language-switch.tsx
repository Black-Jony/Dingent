"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";

import { setUserLocale } from "@/app/actions/locale";
import { type AppLocale, locales } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const localeLabels: Record<AppLocale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  ja: "日本語",
};

export function LanguageSwitch() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("LanguageSwitch");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const changeLocale = (nextLocale: AppLocale) => {
    if (nextLocale === locale) return;

    startTransition(async () => {
      await setUserLocale(nextLocale);
      router.refresh();
    });
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t("label")}
          title={t("label")}
          disabled={isPending}
        >
          <Languages className="size-[1.2rem]" aria-hidden="true" />
          <span className="sr-only">{t("label")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {locales.map((itemLocale) => (
          <DropdownMenuItem
            key={itemLocale}
            onClick={() => changeLocale(itemLocale)}
            lang={itemLocale}
          >
            {localeLabels[itemLocale]}
            <Check
              size={14}
              className={cn("ms-auto", locale !== itemLocale && "hidden")}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
