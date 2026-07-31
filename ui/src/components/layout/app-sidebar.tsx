import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Workspace } from "@/types/entity";
import type { CSSProperties, ReactNode } from "react";

// 模拟数据 (实际应从 props 或 context 获取)
const user = {
  name: "User",
  email: "user@example.com",
  avatar: "/avatars/placeholder.jpg",
};

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
