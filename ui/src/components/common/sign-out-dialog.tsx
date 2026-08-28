"use client";
import { useAuthStore } from "@/store";
import { getBaseUrl } from "@/lib/api/client";
import { ConfirmDialog } from "./confirm-dialog";
import { useTranslations } from "next-intl";

interface SignOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const { logout } = useAuthStore();
  const t = useTranslations("SignOut");

  const handleSignOut = () => {
    logout();
    window.location.href = `${getBaseUrl()}/auth/sso/logout`;
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
