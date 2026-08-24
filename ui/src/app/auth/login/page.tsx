import { Suspense } from "react";
import LoginRoute from "./login-route";
import { getTranslations } from "next-intl/server";

export default async function LoginPageContainer() {
  const t = await getTranslations("Auth");
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Suspense fallback={<div>{t("loading")}</div>}>
        <LoginRoute />
      </Suspense>
    </div>
  );
}
