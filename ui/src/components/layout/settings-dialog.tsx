"use client";

import * as React from "react";
import {
  Bell,
  Briefcase,
  Copy,
  CreditCard,
  ExternalLink,
  Globe,
  Link,
  Lock,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { toast } from "sonner";
import { Workspace } from "@/types/entity";
import { useTranslations } from "next-intl";

// 动态导入组件
const ModelSelector = React.lazy(() =>
  import("@/components/common/model-selector").then((module) => ({
    default: module.ModelSelector,
  })),
);

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
  workspace: Workspace;
}

export function SettingsDialog({
  open,
  onOpenChange,
  defaultTab = "people",
  workspace,
}: SettingsDialogProps) {
  const t = useTranslations("Settings");
  const [activeTab, setActiveTab] = React.useState(defaultTab);
  const sidebarNavItems = React.useMemo(
    () => [
      {
        title: t("groups.account"),
        items: [
          { id: "my-account", title: t("nav.myAccount"), icon: User },
          { id: "preferences", title: t("nav.preferences"), icon: Settings },
          { id: "notifications", title: t("nav.notifications"), icon: Bell },
          { id: "connections", title: t("nav.connections"), icon: Link },
        ],
      },
      {
        title: t("groups.workspace"),
        items: [
          { id: "general", title: t("nav.general"), icon: Settings },
          { id: "people", title: t("nav.people"), icon: Users },
          { id: "teamspaces", title: t("nav.teamspaces"), icon: Briefcase },
          { id: "security", title: t("nav.security"), icon: Shield },
          { id: "identity", title: t("nav.identity"), icon: Lock },
          { id: "billing", title: t("nav.billing"), icon: CreditCard },
        ],
      },
    ],
    [t],
  );
  const activeTabTitle =
    sidebarNavItems
      .flatMap((group) => group.items)
      .find((item) => item.id === activeTab)?.title ?? activeTab;

  React.useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none w-[90vw] h-[85vh] p-0 gap-0 overflow-hidden flex bg-background sm:rounded-xl">
        <DialogTitle className="sr-only">{t("dialogTitle")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("dialogDescription")}
        </DialogDescription>

        {/* === 左侧侧边栏 === */}
        <div className="w-64 bg-muted/30 border-r flex flex-col h-full shrink-0">
          <div className="p-4 text-sm font-medium text-muted-foreground flex items-center gap-2">
            <div className="size-6 bg-primary/10 rounded-full flex items-center justify-center text-xs">
              S
            </div>
            <span className="truncate">user@example.com</span>
          </div>

          <ScrollArea className="flex-1 px-2">
            <div className="space-y-6 p-2">
              {sidebarNavItems.map((group) => (
                <div key={group.title}>
                  <h4 className="mb-2 px-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                    {group.title}
                  </h4>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-sm transition-colors ${
                          activeTab === item.id
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <item.icon className="size-4" />
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <span className="size-4 rounded-full border border-blue-600 flex items-center justify-center text-[10px]">
                ↑
              </span>
              {t("upgradePlan")}
            </Button>
          </div>
        </div>

        {/* === 右侧内容区 === */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {activeTab === "general" ? (
            <GeneralSettingsContent workspace={workspace} />
          ) : activeTab === "people" ? (
            <PeopleSettingsContent />
          ) : (
            <div className="p-8 flex items-center justify-center h-full text-muted-foreground">
              {t("contentUnavailable", { tab: activeTabTitle })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface GeneralSettingsContentProps {
  workspace: Workspace;
}

function GeneralSettingsContent({ workspace }: GeneralSettingsContentProps) {
  const t = useTranslations("Settings");
  const { workspacesApi } = useWorkspaceApi();
  const [guestAccessEnabled, setGuestAccessEnabled] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  // 表单状态
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [workspaceDescription, setWorkspaceDescription] = React.useState("");
  const [defaultModelConfigId, setDefaultModelConfigId] = React.useState<
    string | null
  >(null);
  const [availableModels, setAvailableModels] = React.useState<any[]>([]);

  // 初始化数据
  React.useEffect(() => {
    if (workspace) {
      setGuestAccessEnabled(workspace.allow_guest_access ?? false);
      setWorkspaceName(workspace.name);
      setWorkspaceDescription(workspace.description ?? "");
      setDefaultModelConfigId(workspace.default_model_config_id || null);

      import("@/lib/api/client").then(({ getClientApi }) => {
        getClientApi()
          .forWorkspace(workspace.slug)
          .models.list()
          .then((models) => setAvailableModels(models || []))
          .catch((err) => console.error("Failed to load models:", err));
      });
    }
  }, [workspace]);

  const guestLink = React.useMemo(() => {
    if (!workspace) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/dingent-resource/guest/${workspace.slug}/chat`;
  }, [workspace]);

  const handleToggleGuestAccess = async (enabled: boolean) => {
    if (!workspace || !workspacesApi) return;
    setIsUpdating(true);
    try {
      await workspacesApi.update(workspace.slug, {
        allow_guest_access: enabled,
      });
      setGuestAccessEnabled(enabled);
      toast.success(
        enabled ? t("toast.guestEnabled") : t("toast.guestDisabled"),
      );
    } catch (error) {
      console.error("Failed to update workspace:", error);
      toast.error(t("toast.updateSettingsFailed"));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(guestLink);
      toast.success(t("toast.guestLinkCopied"));
    } catch (error) {
      toast.error(t("toast.copyFailed"));
    }
  };

  // 统一的保存处理函数
  const handleSaveAllChanges = async () => {
    if (!workspace || !workspacesApi) return;
    setIsUpdating(true);

    try {
      await workspacesApi.update(workspace.slug, {
        name: workspaceName,
        description: workspaceDescription,
        default_model_config_id: defaultModelConfigId,
      });
      toast.success(t("toast.workspaceUpdated"));
    } catch (error) {
      console.error("Failed to update workspace:", error);
      toast.error(t("toast.workspaceUpdateFailed"));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!workspace) {
    return (
      <div className="p-8 flex items-center justify-center h-full text-muted-foreground">
        {t("general.noWorkspace")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-8 pb-4">
        <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
          {t("general.title")}
          <span className="text-muted-foreground cursor-help text-xs border rounded-full size-4 flex items-center justify-center">
            ?
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("general.description")}
        </p>
      </div>

      <ScrollArea className="flex-1 px-8 pb-8">
        <div className="space-y-8 max-w-2xl">
          {/* === Basic Information === */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">
              {t("general.basicInformation")}
            </h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">
                  {t("general.workspaceName")}
                </Label>
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder={t("general.workspaceNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace-description">
                  {t("general.workspaceDescription")}
                </Label>
                <Input
                  id="workspace-description"
                  value={workspaceDescription}
                  onChange={(e) => setWorkspaceDescription(e.target.value)}
                  placeholder={t("general.workspaceDescriptionPlaceholder")}
                />
              </div>
              {/* 删除了此处多余的 Save 按钮 */}
            </div>
          </div>

          {/* === Default Model Configuration === */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-sm font-semibold">
              {t("general.defaultModelConfiguration")}
            </h3>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("general.defaultModelDescription")}
              </p>
              <div className="space-y-2">
                <Label htmlFor="default-model">
                  {t("general.defaultModel")}
                </Label>
                <React.Suspense
                  fallback={
                    <div className="h-10 bg-muted animate-pulse rounded" />
                  }
                >
                  {availableModels.length > 0 ? (
                    <ModelSelector
                      models={availableModels}
                      value={defaultModelConfigId}
                      onChange={(val: any) => {
                        setDefaultModelConfigId(val || null);
                      }}
                      placeholder={t("general.environmentDefault")}
                      allowClear={true}
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {t("general.noModels")}{" "}
                      <a
                        href={`/${workspace.slug}/models`}
                        className="text-primary underline"
                      >
                        {t("general.configureModels")}
                      </a>{" "}
                      {t("general.first")}
                    </div>
                  )}
                </React.Suspense>
              </div>
            </div>
          </div>

          {/* === Global Save Button (放置在所有表单下方) === */}
          <div className="pt-6">
            <Button
              onClick={handleSaveAllChanges}
              disabled={isUpdating}
              size="sm"
            >
              {t("general.saveAll")}
            </Button>
          </div>

          {/* === Guest Access Section === */}
          <div className="space-y-4 pt-6 border-t">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="size-4" />
                  {t("general.guestAccess")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("general.guestAccessDescription")}
                </p>
              </div>
              <Switch
                checked={guestAccessEnabled}
                onCheckedChange={handleToggleGuestAccess}
                disabled={isUpdating}
              />
            </div>

            {guestAccessEnabled && (
              <div className="space-y-3 pl-6 pt-2">
                <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {t("general.shareableGuestLink")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={guestLink}
                      readOnly
                      className="font-mono text-xs flex-1"
                      aria-label={t("general.guestLinkAria")}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="shrink-0"
                    >
                      <Copy className="size-4 mr-1" />
                      {t("general.copy")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("general.shareGuestLinkHelp")}
                  </p>
                </div>

                <div className="p-3 border rounded-md bg-blue-50 dark:bg-blue-950/20 text-sm">
                  <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    {t("general.securityNote")}
                  </div>
                  <p className="text-blue-800 dark:text-blue-200 text-xs">
                    {t("general.securityNoteDescription")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// PeopleSettingsContent 保持不变
function PeopleSettingsContent() {
  const t = useTranslations("Settings");
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-8 pb-4">
        <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
          {t("people.title")}
          <span className="text-muted-foreground cursor-help text-xs border rounded-full size-4 flex items-center justify-center">
            ?
          </span>
        </h2>
      </div>

      <ScrollArea className="flex-1 px-8 pb-8">
        <div className="mb-8">
          <div className="text-sm font-medium mb-2">
            {t("people.inviteLink")}
          </div>
          <div className="flex items-center justify-between p-3 border rounded-md bg-card">
            <div className="text-xs text-muted-foreground">
              {t("people.invitePermission")}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="h-7 text-xs">
                {t("people.copyLink")}
              </Button>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        <Tabs defaultValue="members" className="w-full">
          <div className="flex items-center justify-between mb-4 border-b">
            <TabsList className="h-auto p-0 bg-transparent gap-6">
              <TabsTrigger
                value="guests"
                className="px-0 py-2 rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none font-normal"
              >
                {t("people.guests")}
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="px-0 py-2 rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none font-normal"
              >
                {t("people.members")}{" "}
                <span className="ml-1 text-muted-foreground">1</span>
              </TabsTrigger>
              <TabsTrigger
                value="groups"
                className="px-0 py-2 rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none font-normal"
              >
                {t("people.groups")}
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 py-2">
              <Input
                placeholder={t("people.filterPlaceholder")}
                className="h-8 w-[150px] lg:w-[200px]"
              />
              <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700">
                {t("people.addMembers")}
              </Button>
            </div>
          </div>

          <TabsContent value="members" className="mt-0">
            <div className="space-y-1">
              <div className="flex items-center justify-between py-3 border-b border-border/50 group hover:bg-muted/30 px-2 -mx-2 rounded">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    S
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      Saya&apos;s Notion{" "}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({t("people.you")})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      c3313433633@gmail.com
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("people.workspaceOwner")}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="guests" className="mt-10 text-center">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Users className="size-10 mb-3 opacity-20" />
              <p className="text-sm">{t("people.noGuests")}</p>
            </div>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
