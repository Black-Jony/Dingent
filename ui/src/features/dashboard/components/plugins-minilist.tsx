import { Skeleton } from "@/components/ui/skeleton";
import { OverviewPluginItem } from "@/types/entity";
import { useTranslations } from "next-intl";

export function PluginsMiniList({
  plugins,
  loading,
  max = 6,
}: {
  plugins: OverviewPluginItem[];
  loading?: boolean;
  max?: number;
}) {
  const t = useTranslations("Overview");
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-5 w-40" />
      </div>
    );
  }
  if (!plugins?.length) {
    return (
      <div className="text-muted-foreground text-sm">{t("noPlugins")}</div>
    );
  }
  return (
    <ul className="space-y-1 text-sm">
      {plugins.slice(0, max).map((p) => (
        <li
          key={p.id}
          className="hover:bg-muted/50 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded border px-2 py-1"
        >
          <span className="font-medium">{p.name}</span>
          <span className="text-muted-foreground text-xs">v{p.version}</span>
          <span className="text-muted-foreground text-xs">
            {t("tools", { count: p.tool_count })}
          </span>
        </li>
      ))}
      {plugins.length > max && (
        <li className="text-muted-foreground text-xs">
          {t("more", { count: plugins.length - max })}
        </li>
      )}
    </ul>
  );
}
