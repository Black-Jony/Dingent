"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus,
  MessageSquare,
  Settings,
  MoreHorizontal,
  LayoutDashboard, // 替换 Settings 图标用于 Go to Dashboard
} from "lucide-react";
import { useThreadContext } from "@/providers/ThreadProvider";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { Workspace } from "@/types/entity";
import { useTranslations } from "next-intl";

type ThreadGroupKey = "today" | "yesterday" | "previousSevenDays" | "older";

const THREAD_GROUP_ORDER: ThreadGroupKey[] = [
  "today",
  "yesterday",
  "previousSevenDays",
  "older",
];

const groupThreadsByDate = (threads: any[]) => {
  const groups: Record<ThreadGroupKey, typeof threads> = {
    today: [],
    yesterday: [],
    previousSevenDays: [],
    older: [],
  };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const sortedThreads = [...threads].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  sortedThreads.forEach((thread) => {
    const date = new Date(thread.updatedAt || thread.createdAt || new Date());
    if (date >= today) groups.today.push(thread);
    else if (date >= yesterday) groups.yesterday.push(thread);
    else if (date >= lastWeek) groups.previousSevenDays.push(thread);
    else groups.older.push(thread);
  });

  return THREAD_GROUP_ORDER.map((key) => [key, groups[key]] as const).filter(
    ([, items]) => items.length > 0,
  );
};

interface ChatHistorySidebarProps {
  workspaces: Workspace[];
}

export function ChatHistorySidebar({ workspaces }: ChatHistorySidebarProps) {
  const t = useTranslations("Chat");
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    createThread,
    deleteThread,
    deleteAllThreads,
  } = useThreadContext();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  const groupedThreads = useMemo(() => groupThreadsByDate(threads), [threads]);
  const groupLabels: Record<ThreadGroupKey, string> = {
    today: t("sidebar.groups.today"),
    yesterday: t("sidebar.groups.yesterday"),
    previousSevenDays: t("sidebar.groups.previousSevenDays"),
    older: t("sidebar.groups.older"),
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<
    Partial<Record<ThreadGroupKey, boolean>>
  >({});

  const toggleGroup = (label: ThreadGroupKey) => {
    setCollapsedGroups((previous) => ({
      ...previous,
      [label]: !previous[label],
    }));
  };

  const handleNewChat = () => {
    createThread();
    if (isMobile) setOpenMobile(false);
  };

  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
    if (isMobile) setOpenMobile(false);
  };

  const { slug } = useWorkspaceApi();
  const handleDeleteAll = () => {
    if (window.confirm(t("sidebar.clearConfirm"))) {
      deleteAllThreads();
    }
  };

  // Check if we're in guest mode by checking if the path starts with /guest/
  const isGuestMode = pathname.startsWith("/guest/");

  return (
    <AppSidebar
      workspaces={workspaces}
      isGuest={isGuestMode}
      collapsed={isSidebarCollapsed}
    >
      {/* --- 区域 1: 头部 --- */}
      <SidebarHeader className="p-3 pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              aria-label={
                isSidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")
              }
              title={
                isSidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")
              }
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
              className="h-10 border border-sidebar-border bg-sidebar shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
              {!isSidebarCollapsed && (
                <span className="font-medium">{t("sidebar.collapse")}</span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          {!isSidebarCollapsed && (
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                onClick={handleNewChat}
                className="h-10 border border-sidebar-border bg-sidebar shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98] transition-all"
              >
                <Plus className="mr-2 size-4 text-muted-foreground" />
                <span className="font-medium">{t("sidebar.newChat")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarHeader>

      {/* --- 区域 2: 内容区 --- */}
      {!isSidebarCollapsed && (
        <SidebarContent className="px-2 scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent">
          {threads.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground/60">
              <MessageSquare className="mb-2 size-8 opacity-20" />
              <p>{t("sidebar.noHistory")}</p>
            </div>
          ) : (
            groupedThreads.map(([label, groupThreads]) => (
              <SidebarGroup key={label} className="pt-4">
                <SidebarGroupLabel asChild>
                  <button
                    type="button"
                    aria-expanded={!collapsedGroups[label]}
                    className="flex w-full cursor-pointer select-none items-center justify-between px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/50"
                    onClick={() => toggleGroup(label)}
                  >
                    <span>{groupLabels[label]}</span>
                    {collapsedGroups[label] ? (
                      <ChevronRight className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                  </button>
                </SidebarGroupLabel>
                {!collapsedGroups[label] && (
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {groupThreads.map((thread: any) => (
                        <SidebarMenuItem key={thread.id}>
                          <SidebarMenuButton
                            isActive={thread.id === activeThreadId}
                            onClick={() => handleSelectThread(thread.id)}
                            className="h-9 group/item transition-colors"
                          >
                            <span className="truncate w-full text-sm">
                              {thread.title === "New Chat"
                                ? t("sidebar.newChat")
                                : thread.title || t("sidebar.untitled")}
                            </span>
                          </SidebarMenuButton>

                          {/* 下拉菜单逻辑保持不变 */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction
                                showOnHover
                                className="right-1 opacity-0 transition-opacity group-hover/item:opacity-100 data-[state=open]:opacity-100"
                              >
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">
                                  {t("sidebar.more")}
                                </span>
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              className="w-48"
                              align="start"
                              side="right"
                            >
                              <DropdownMenuItem>
                                <Settings className="mr-2 size-4 text-muted-foreground" />
                                <span>{t("sidebar.rename")}</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteThread(thread.id);
                                }}
                              >
                                <Trash2 className="mr-2 size-4" />
                                <span>{t("sidebar.delete")}</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            ))
          )}
        </SidebarContent>
      )}

      {/* --- 区域 3: 底部 --- */}
      {!isSidebarCollapsed && (
        <SidebarFooter className="p-2">
          <SidebarMenu>
            {threads.length > 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleDeleteAll}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-4" />
                  <span>{t("sidebar.clearHistory")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {!isGuestMode && (
              <>
                <SidebarSeparator className="my-2 opacity-50" />

                <SidebarMenuItem>
                  <SidebarMenuButton className="text-sidebar-foreground/80">
                    <LayoutDashboard className="size-4" />
                    <Link href={`/${slug}/overview`}>
                      <span>{t("sidebar.goToDashboard")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarFooter>
      )}
    </AppSidebar>
  );
}
