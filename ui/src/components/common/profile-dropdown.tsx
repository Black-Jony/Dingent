"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClientApi } from "@/lib/api/client";
import { SettingsDialog } from "@/components/layout/settings-dialog";
import type { AuthUser, Workspace } from "@/types/entity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useDialogState } from "@/hooks/use-dialog-state";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { SignOutDialog } from "./sign-out-dialog";
import { useTranslations } from "next-intl";

export function ProfileDropdown({ workspace }: { workspace: Workspace }) {
  const [open, setOpen] = useDialogState();
  const t = useTranslations("Profile");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: user } = useQuery<AuthUser>({
    queryKey: ["current-user"],
    queryFn: () => getClientApi().auth.getMe(),
  });
  const displayName = user?.full_name || user?.email || t("profile");

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-8 w-8 rounded-full"
            aria-label={t("open")}
            title={t("open")}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1.5">
              <p className="truncate text-sm leading-none font-medium">
                {displayName}
              </p>
              <p className="text-muted-foreground text-xs leading-none">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <a
                href="https://sso.cncb.ac.cn/account/api/go-user-profile"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("profile")}
                <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>{t("billing")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              {t("settings")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>{t("newTeam")}</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>
            {t("signOut")}
            <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        defaultTab="general"
        workspace={workspace}
        user={user ? { name: displayName, email: user.email } : undefined}
      />
    </>
  );
}
