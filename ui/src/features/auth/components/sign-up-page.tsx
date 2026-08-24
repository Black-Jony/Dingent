import { SignUpForm } from "@/components/common/sign-up-from";
import { AuthLayout } from "@/components/layout/auth-layout";
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

export function SignUpPage({ api }: { api: ApiClient }) {
  const t = useTranslations("Auth");
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-lg tracking-tight">
          {t("createAccount")}
        </CardTitle>
        <CardDescription>
          {t("signUpDescription")} <br />
          {t("alreadyHaveAccount")}{" "}
          <Link
            href="/auth/login"
            className="hover:text-primary underline underline-offset-4"
          >
            {t("signIn")}
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm api={api} />{" "}
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground px-8 text-center text-sm">
          {t("byCreating")}{" "}
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
