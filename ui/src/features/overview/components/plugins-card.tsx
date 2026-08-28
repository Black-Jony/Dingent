import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { PluginsMiniList } from "@/features/dashboard/components/plugins-minilist";
import { OverviewData } from "@/types/entity";
import { useTranslations } from "next-intl";

interface PluginsCardProps {
  plugins: OverviewData["plugins"];
}

export function PluginsCard({ plugins }: PluginsCardProps) {
  const t = useTranslations("Overview");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("plugins")}</CardTitle>
        <CardDescription>
          {plugins
            ? t("installedCount", { count: plugins.installed_total })
            : t("installedPlugins")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PluginsMiniList plugins={plugins?.list || []} />
      </CardContent>
    </Card>
  );
}
