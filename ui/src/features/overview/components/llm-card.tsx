import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { LLMInfo } from "@/features/dashboard/components/llm-info";
import { OverviewData } from "@/types/entity";
import { useTranslations } from "next-intl";

interface LlmCardProps {
  llm: OverviewData["llm"];
}

export function LlmCard({ llm }: LlmCardProps) {
  const t = useTranslations("Overview");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("llmConfiguration")}</CardTitle>
        <CardDescription>{t("llmDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LLMInfo llm={llm || {}} />
      </CardContent>
    </Card>
  );
}
