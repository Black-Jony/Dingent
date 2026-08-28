import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { useTranslations } from "next-intl";

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ title, message, onRetry }: ErrorDisplayProps) {
  const t = useTranslations("ErrorDisplay");
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center h-[400px]">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-5 w-5 text-red-600" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">{title ?? t("title")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ?? t("message")}
      </p>
      {onRetry && (
        <Button onClick={onRetry} className="mt-4" variant="outline">
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
