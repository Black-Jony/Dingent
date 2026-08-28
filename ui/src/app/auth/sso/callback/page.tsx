import { Suspense } from "react";
import SsoCallbackRoute from "./sso-callback-route";
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("Auth");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          {t("ssoCompleting")}
        </div>
      }
    >
      <SsoCallbackRoute />
    </Suspense>
  );
}
