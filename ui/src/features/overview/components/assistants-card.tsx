import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { AssistantsTable } from "@/features/dashboard/components/assistants-table";
import { OverviewData } from "@/types/entity";
import { useTranslations } from "next-intl";

interface AssistantsCardProps {
  assistants: OverviewData["assistants"];
  error: string | null;
}

export function AssistantsCard({ assistants, error }: AssistantsCardProps) {
  const t = useTranslations("Overview");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("assistants")}</CardTitle>
        <CardDescription>
          {assistants
            ? t("assistantSummary", {
                total: assistants.total,
                active: assistants.active,
                inactive: assistants.inactive,
              })
            : t("assistantOverview")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-destructive mb-2 text-sm">
            {t("failedToLoad", { error })}
          </div>
        )}
        <AssistantsTable items={assistants?.list || []} />
      </CardContent>
    </Card>
  );
}
