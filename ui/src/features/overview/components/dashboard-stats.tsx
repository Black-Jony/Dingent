import { OverviewData } from "@/types/entity";
import { StatCard } from "./stat-card";
import { useTranslations } from "next-intl";

interface DashboardStatsProps {
  stats: OverviewData | null;
  error: boolean;
}

export function DashboardStats({ stats, error }: DashboardStatsProps) {
  const t = useTranslations("Overview");
  const assistants = stats?.assistants;
  const plugins = stats?.plugins;
  const workflows = stats?.workflows;
  const market = stats?.market;

  const assistantActivationRate = (() => {
    if (!assistants) return "";
    if (!assistants.total) return t("activePercent", { percent: 0 });
    const percent = ((assistants.active / assistants.total) * 100).toFixed(0);
    return t("activePercent", { percent });
  })();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t("assistants")}
        value={assistants ? assistants.total : "--"}
        sub={assistantActivationRate}
        error={error}
      />
      <StatCard
        title={t("activeAssistants")}
        value={assistants ? assistants.active : "--"}
        sub={assistants ? t("inactive", { count: assistants.inactive }) : ""}
        error={error}
      />
      <StatCard
        title={t("plugins")}
        value={plugins ? plugins.installed_total : "--"}
        sub={
          market
            ? market.plugin_updates > 0
              ? t("updatesAvailable", { count: market.plugin_updates })
              : t("upToDate")
            : ""
        }
        error={error}
      />
      <StatCard
        title={t("workflows")}
        value={workflows ? workflows.total : "--"}
        sub={
          workflows?.active_workflow_id
            ? t("activeWorkflow", { id: workflows.active_workflow_id })
            : t("noActiveWorkflow")
        }
        error={error}
      />
    </div>
  );
}
