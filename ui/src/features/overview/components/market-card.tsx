import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OverviewData } from "@/types/entity";
import { useTranslations } from "next-intl";

interface OverviewMarketCardProps {
  market: OverviewData["market"];
  loading: boolean;
}

export function OverviewMarketCard({
  market,
  loading,
}: OverviewMarketCardProps) {
  const t = useTranslations("Overview");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("market")}</CardTitle>
        <CardDescription>
          {market?.metadata?.version
            ? t("marketVersion", { version: market.metadata.version })
            : t("marketMetadata")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {loading ? (
          <Skeleton className="h-5 w-40" />
        ) : market ? (
          <>
            <div>
              {t("pluginUpdates")}{" "}
              {market.plugin_updates > 0 ? (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {t("available", { count: market.plugin_updates })}
                </span>
              ) : (
                <span className="text-muted-foreground">{t("noUpdates")}</span>
              )}
            </div>
            {market.metadata?.counts && (
              <div className="text-muted-foreground">
                {t("counts", {
                  counts: JSON.stringify(market.metadata.counts),
                })}
              </div>
            )}
          </>
        ) : (
          <div className="text-muted-foreground">{t("marketUnavailable")}</div>
        )}
      </CardContent>
    </Card>
  );
}
