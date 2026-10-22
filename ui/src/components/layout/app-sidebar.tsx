"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Workspace, AuthUser } from "@/types/entity";
import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClientApi } from "@/lib/api/client";

type AppSidebarProps = {
  children: ReactNode;
  workspaces: Workspace[];
  isGuest?: boolean;
  collapsed?: boolean;
};

export function AppSidebar({
  children,
  workspaces,
  isGuest = false,
  collapsed = false,
}: AppSidebarProps) {
  const { data: currentUser } = useQuery<AuthUser>({
    queryKey: ["current-user"],
    enabled: !isGuest,
    queryFn: () => getClientApi().auth.getMe(),
  });
  const user = {
    name: currentUser?.full_name || currentUser?.email || "",
    email: currentUser?.email || "",
    avatar: "",
  };
  return (
    <Sidebar
      collapsible="none"
      variant="inset"
      className="h-screen overflow-hidden flex flex-col"
      style={
        collapsed
          ? ({ "--sidebar-width": "3.5rem" } as CSSProperties)
          : undefined
      }
    >
      <SidebarHeader>
        {isGuest || collapsed ? (
          <div />
        ) : (
          <WorkspaceSwitcher workspaces={workspaces} user={user} />
        )}
      </SidebarHeader>

      <SidebarContent>{children}</SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
