"use client";

import { format } from "date-fns";
import { enUS, ja, zhCN } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "../ui/calendar";

type DatePickerProps = {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  placeholder?: string;
};

export function DatePicker({
  selected,
  onSelect,
  placeholder,
}: DatePickerProps) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const dateLocale = locale === "zh-CN" ? zhCN : locale === "ja" ? ja : enUS;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!selected}
          className="data-[empty=true]:text-muted-foreground w-[240px] justify-start text-start font-normal"
        >
          {selected ? (
            format(selected, "PP", { locale: dateLocale })
          ) : (
            <span>{placeholder ?? t("pickDate")}</span>
          )}
          <CalendarIcon className="ms-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selected}
          onSelect={onSelect}
          disabled={(date: Date) =>
            date > new Date() || date < new Date("1900-01-01")
          }
        />
      </PopoverContent>
    </Popover>
  );
}
