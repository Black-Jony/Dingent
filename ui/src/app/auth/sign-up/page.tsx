import { Suspense } from "react";
import LoginRoute from "./sign-up-route";
import { getTranslations } from "next-intl/server";

export default async function SignUpPageContainer() {
  const t = await getTranslations("Auth");
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Suspense fallback={<div>{t("loading")}</div>}>
        <LoginRoute />
      </Suspense>
    </div>
  );
}
