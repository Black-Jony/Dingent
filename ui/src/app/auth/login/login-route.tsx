"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { getClientApi } from "../../../lib/api/client";
import { LoginPage } from "@/features/auth/components/login-page";
import { getSafeReturnPath } from "@/lib/safe-urls";

export default function LoginRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = getClientApi();

  const handleLoginSuccess = () => {
    const returnTo =
      searchParams.get("next") ??
      searchParams.get("callbackUrl") ??
      searchParams.get("redirect");
    router.replace(getSafeReturnPath(returnTo));
  };

  return <LoginPage onLoginSuccess={handleLoginSuccess} api={api} />;
}
