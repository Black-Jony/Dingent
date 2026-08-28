"use client";

import { UserAuthForm } from "@/components/common/user-auth-form";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { ApiClient } from "@/services";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface LoginPageProps {
  api: ApiClient;
  onLoginSuccess: (token: string) => void;
  onLoginFail?: (error: Error) => void;
}
export function LoginPage({
  api,
  onLoginSuccess,
  onLoginFail,
}: LoginPageProps) {
  const t = useTranslations("Auth");
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-lg tracking-tight">{t("signIn")}</CardTitle>
        <CardDescription>{t("signInDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <UserAuthForm
          api={api}
          onLoginSuccess={onLoginSuccess}
          onLoginFail={onLoginFail}
        />
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground px-8 text-center text-sm">
          {t("bySigningIn")}{" "}
          <Link
            href="/terms"
            className="hover:text-primary underline underline-offset-4"
          >
            {t("terms")}
          </Link>{" "}
          {t("and")}{" "}
          <Link
            href="/privacy"
            className="hover:text-primary underline underline-offset-4"
          >
            {t("privacy")}
          </Link>
          .
        </p>
      </CardFooter>
    </Card>
  );
}
