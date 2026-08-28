"use client";

import { useTranslations } from "next-intl";
import { SlidersHorizontal, ArrowUpAZ, ArrowDownAZ } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CategoryFilter,
  SortOption,
  useMarketFilters,
} from "../hooks/use-market-filters";

const CATEGORY_KEYS: CategoryFilter[] = [
  "all",
  "plugin",
  "assistant",
  "workflow",
];

export function MarketToolbar() {
  const t = useTranslations("Market");
  const { filters, setSearch, setCategory, setSort } = useMarketFilters();
  const categoryLabels: Record<CategoryFilter, string> = {
    all: t("all"),
    plugin: t("plugins"),
    assistant: t("assistants"),
    workflow: t("workflows"),
  };

  return (
    <div className="my-4 flex flex-col justify-between gap-4 sm:my-0 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-4 sm:my-4 sm:flex-row">
        <Input
          placeholder={t("search")}
          className="h-9 w-40 lg:w-[250px]"
          // 这里使用 defaultValue 配合 onChange，或者受控组件都可以
          // 如果需要极速响应，保持 value={filters.search} 即可
          value={filters.search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={filters.category}
          onValueChange={(v) => setCategory(v as CategoryFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue>{categoryLabels[filters.category]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {categoryLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Select
        value={filters.sort}
        onValueChange={(v) => setSort(v as SortOption)}
      >
        <SelectTrigger className="w-16">
          <SelectValue>
            <SlidersHorizontal size={18} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="asc">
            <div className="flex items-center gap-4">
              <ArrowUpAZ size={16} /> <span>{t("ascending")}</span>
            </div>
          </SelectItem>
          <SelectItem value="desc">
            <div className="flex items-center gap-4">
              <ArrowDownAZ size={16} /> <span>{t("descending")}</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
