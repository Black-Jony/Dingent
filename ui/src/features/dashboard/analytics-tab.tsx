"use client";
import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { StatCard } from "../overview/components/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsData } from "@/types/entity";
import { OverviewApi } from "@/services/dashboard";

function useAnalytics({ wsApi }: { wsApi: { overview: OverviewApi } }) {
  // The type here should match what your API function returns.
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    wsApi.overview
      .getBudget()
      .then((apiData) => {
        setData(apiData);
      })
      .catch((err) => {
        // 2. Catch any errors
        setError(err.message);
      })
      .finally(() => {
        // 3. This runs regardless of success or failure
        setLoading(false);
      });
  }, []); // The empty array ensures this effect runs only once on mount

  return { data, loading, error };
}

export function AnalyticsTab({ wsApi }: { wsApi: { overview: OverviewApi } }) {
  const t = useTranslations("Analytics");
  const { data, loading } = useAnalytics({ wsApi });

  const budgetUsage = useMemo(() => {
    if (!data || !data.total_budget) return 0;
    return (data.current_cost / data.total_budget) * 100;
  }, [data]);

  const modelCostEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.model_cost);
  }, [data]);

  return (
    <div className="space-y-4">
      {/* 3. UPDATED: Summary cards now reflect available data */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("currentCost")}
          value={data ? `$${data.current_cost.toFixed(5)}` : "--"}
          sub={t("totalBudget", {
            value: data ? `${data.total_budget.toFixed(2)}` : "--",
          })}
          loading={loading}
        />
        <StatCard
          title={t("budgetUsage")}
          value={data ? `${budgetUsage.toFixed(2)}%` : "--"}
          sub={t("budgetUsageDescription")}
          loading={loading}
        />
        <StatCard
          title={t("totalInvocations")}
          value="--"
          sub={t("dataUnavailable")}
          loading={loading}
        />
        <StatCard
          title={t("successRate")}
          value="--"
          sub={t("dataUnavailable")}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="col-span-1 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("usageOverTime")}</CardTitle>
              {/* 4. UPDATED: Message for unimplemented feature */}
              <CardDescription>{t("timeSeriesPending")}</CardDescription>
            </CardHeader>
            <CardContent className="flex h-[300px] items-center justify-center">
              <div className="text-muted-foreground">{t("chartPending")}</div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-1">
          {/* 5. UPDATED: Replaced "Top Assistants" with "Cost by Model" */}
          <Card>
            <CardHeader>
              <CardTitle>{t("costByModel")}</CardTitle>
              <CardDescription>{t("costByModelDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <ul className="space-y-2">
                  {modelCostEntries.map(([model, cost]) => (
                    <li key={model} className="flex justify-between text-sm">
                      <span>{model}</span>
                      <span className="font-mono">${cost.toFixed(5)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
