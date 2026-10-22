"use client";
import { useAuthStore } from "@/store";
import { getBaseUrl, getClientApi } from "@/lib/api/client";
import { ConfirmDialog } from "./confirm-dialog";
import { useTranslations } from "next-intl";

interface SignOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const { logout } = useAuthStore();
  const t = useTranslations("SignOut");

  const handleSignOut = async () => {
    logout();
    const config = await getClientApi()
      .auth.getConfig()
      .catch(() => null);
    window.location.href = config?.sso_enabled
      ? `${getBaseUrl()}/auth/sso/logout`
      : "/dingent-resource/auth/login";
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      confirmText={t("confirm")}
      onConfirm={handleSignOut}
      className="sm:max-w-sm"
    />
  );
}
