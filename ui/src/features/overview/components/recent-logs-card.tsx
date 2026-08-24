import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { RecentLogs } from "@/features/dashboard/components/recent-logs";
import { OverviewData } from "@/types/entity";
import { useTranslations } from "next-intl";

interface RecentLogsCardProps {
  logs: OverviewData["logs"];
}

export function RecentLogsCard({ logs }: RecentLogsCardProps) {
  const t = useTranslations("Overview");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("recentLogs")}</CardTitle>
        <CardDescription>
          {logs?.stats?.total
            ? t("totalLogs", { count: logs.stats.total })
            : t("latestLogs")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RecentLogs logs={logs?.recent || []} limit={8} />
      </CardContent>
    </Card>
  );
}
