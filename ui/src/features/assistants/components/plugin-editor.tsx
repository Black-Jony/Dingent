"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { safeBool, effectiveStatusForItem, toStr } from "@/lib/utils";
import {
  Assistant,
  AssistantPlugin,
  PluginManifest,
  LLMModelConfig,
} from "@/types/entity";
import { StatusBadge } from "@/components/common/status-badge";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/common/searchable-select";
import { ModelSelector } from "@/components/common/model-selector";

function PluginEditor({
  plugin,
  onChange,
  onRemove,
  isRemoving,
}: {
  plugin: AssistantPlugin;
  onChange: (p: AssistantPlugin) => void;
  onRemove: () => void;
  isRemoving?: boolean;
}) {
  const t = useTranslations("Assistants");
  const common = useTranslations("Common");
  const enabled = safeBool(plugin.enabled, false);
  const { level, label } = effectiveStatusForItem(plugin.status, enabled);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [editingToolIndex, setEditingToolIndex] = useState<number | null>(null);
  const [tempDescription, setTempDescription] = useState<string>("");

  return (
    <div className="rounded-md border p-4">
      {" "}
      {/* Increased padding for better readability */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-mono">
            {t("plugin", { name: toStr(plugin.display_name) })}
          </div>

          <StatusBadge level={level} label={label} title={plugin.status} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {common("enable")}
            </span>

            <Switch
              checked={enabled}
              onCheckedChange={(v) => onChange({ ...plugin, enabled: v })}
            />
          </div>

          <ConfirmDialog
            title={t("confirmRemovePlugin")}
            description={t("removePluginDescription", {
              name: plugin.display_name,
            })}
            confirmText={t("confirmRemove")}
            onConfirm={onRemove}
            trigger={
              <Button
                variant="destructive"
                size="icon"
                disabled={isRemoving} // Disable the button while loading
              >
                {isRemoving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "🗑️"
                )}
              </Button>
            }
          />
        </div>
      </div>
      {plugin.enabled && plugin.config && plugin.config.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setIsConfigExpanded((prev) => !prev)}
            className="
      w-full flex items-center justify-between
      px-3 py-2 rounded-md border bg-muted/40
      hover:bg-muted transition
      text-sm font-medium text-left
    "
          >
            <div className="flex items-center gap-2">
              {isConfigExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {t("userConfiguration")}
            </div>

            <span className="text-xs text-muted-foreground">
              {t("settingsCount", { count: plugin.config.length })}
            </span>
          </button>

          {isConfigExpanded && (
            <div className="space-y-3">
              <div className="text-sm font-medium">
                {t("userConfiguration")}
              </div>

              {plugin.config.map((item, idx) => {
                const id = `cfg_${plugin.registry_id}_${idx}`;
                const label = `${item.name}${item.required ? ` (${t("required")})` : ""}`;
                const desc =
                  item.description || t("setValue", { name: item.name });
                const rawValue = item.value ?? item.default ?? "";

                const updateValue = (
                  nextValue: string | number | boolean | null,
                ) => {
                  const next = structuredClone(plugin);
                  const config = next.config;
                  if (!config || config.length <= idx) return;

                  config[idx]!.value = nextValue;
                  onChange(next);
                };

                // integer
                if (item.type === "integer") {
                  const display = rawValue === null ? "" : String(rawValue);

                  return (
                    <div
                      key={id}
                      className="grid grid-cols-1 gap-2 md:grid-cols-[240px_1fr]"
                    >
                      <Label htmlFor={id}>{label}</Label>
                      <Input
                        id={id}
                        type="number"
                        value={display}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            updateValue(null);
                          } else {
                            const n = Number(v);
                            updateValue(Number.isFinite(n) ? n : null);
                          }
                        }}
                        placeholder={desc}
                      />
                    </div>
                  );
                }

                // float
                if (item.type === "float") {
                  const display = rawValue === null ? "" : String(rawValue);

                  return (
                    <div
                      key={id}
                      className="grid grid-cols-1 gap-2 md:grid-cols-[240px_1fr]"
                    >
                      <Label htmlFor={id}>{label}</Label>
                      <Input
                        id={id}
                        type="number"
                        step="any"
                        value={display}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            updateValue(null);
                          } else {
                            const n = Number(v);
                            updateValue(Number.isFinite(n) ? n : null);
                          }
                        }}
                        placeholder={desc}
                      />
                    </div>
                  );
                }

                // bool
                if (item.type === "bool") {
                  const checked =
                    typeof rawValue === "boolean"
                      ? rawValue
                      : Boolean(rawValue ?? false);

                  return (
                    <div
                      key={id}
                      className="grid grid-cols-1 gap-2 md:grid-cols-[240px_1fr]"
                    >
                      <Label htmlFor={id}>{label}</Label>
                      <div className="flex items-center gap-2">
                        <input
                          id={id}
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => updateValue(e.target.checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {desc}
                        </span>
                      </div>
                    </div>
                  );
                }

                // string
                const display =
                  rawValue === null || rawValue === undefined
                    ? ""
                    : String(rawValue);

                return (
                  <div
                    key={id}
                    className="grid grid-cols-1 gap-2 md:grid-cols-[240px_1fr]"
                  >
                    <Label htmlFor={id}>{label}</Label>
                    <Input
                      id={id}
                      type={item.secret ? "password" : "text"}
                      value={display}
                      onChange={(e) => updateValue(e.target.value)}
                      placeholder={desc}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {!!plugin.tools?.length && (
        <div className="mt-4">
          <div className="text-sm font-medium">{t("tools")}</div>

          <div className="mt-2 space-y-2">
            {" "}
            {/* Increased space-y for tools */}
            {plugin.tools!.map((tool, k) => (
              <div
                key={k}
                className="flex items-start justify-between rounded border p-3"
              >
                {" "}
                {/* Increased padding and items-start for better alignment */}
                <div className="flex-1 min-w-0">
                  <div className="font-mono">{tool.name}</div>

                  {editingToolIndex === k ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={tempDescription}
                        onChange={(e) => setTempDescription(e.target.value)}
                        placeholder={t("toolDescriptionPlaceholder")}
                        className="min-h-[60px] text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            const next = structuredClone(plugin);
                            if (next.tools && next.tools.length > k) {
                              next.tools[k]!.description = tempDescription;
                            }
                            onChange(next);
                            setEditingToolIndex(null);
                            setTempDescription("");
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingToolIndex(null);
                            setTempDescription("");
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    tool.description && (
                      <div className="text-muted-foreground text-xs">
                        {tool.description}
                      </div>
                    )
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-muted-foreground text-sm">
                    {common("enable")}
                  </span>

                  <Switch
                    checked={safeBool(tool.enabled, false)}
                    onCheckedChange={(v) => {
                      const next = structuredClone(plugin);
                      const tools = next.tools;
                      if (tools && tools.length > k) {
                        tools[k]!.enabled = v;
                      }
                      onChange(next);
                    }}
                  />

                  {editingToolIndex !== k && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingToolIndex(k);
                        setTempDescription(tool.description || "");
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AssistantEditor({
  assistant,
  onChange,
  availablePlugins,
  availableModels = [],
  onAddPlugin,
  isAddingPlugin,
  addingPluginDetails,
  onRemovePlugin,
  isRemovingPlugin,
  removingPluginDetails,
}: {
  assistant: Assistant;
  onChange: (a: Assistant) => void;
  availablePlugins: PluginManifest[];
  availableModels?: LLMModelConfig[];
  onAddPlugin: (pluginId: string) => void;
  isAddingPlugin: boolean;
  addingPluginDetails: { assistantId: string; pluginId: string } | null;
  onRemovePlugin: (registry_id: string) => void;
  isRemovingPlugin: boolean;
  removingPluginDetails: { assistantId: string; pluginId: string } | null;
}) {
  const t = useTranslations("Assistants");
  const common = useTranslations("Common");
  const enabled = safeBool(assistant.enabled, false);

  const currentIds = new Set(
    (assistant.plugins || []).map((p) => p.registry_id),
  );

  const addable = useMemo(
    () =>
      availablePlugins
        .filter((p) => !currentIds.has(p.registry_id))
        .map((p) => ({ value: p.registry_id, label: p.display_name })),
    [availablePlugins, currentIds],
  );

  const [selectedPluginIdToAdd, setSelectedPluginIdToAdd] =
    useState<string>("");

  const isCurrentlyAdding =
    isAddingPlugin && addingPluginDetails?.assistantId === assistant.id;

  return (
    <div className="space-y-6">
      {" "}
      {/* Increased space-y for better section separation */}
      <h3 className="text-base font-semibold">{t("basicSettings")}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>{t("assistantName")}</Label>
          <Input
            value={assistant.name || ""}
            onChange={(e) => onChange({ ...assistant, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("enableAssistant")}</Label>
          <div className="flex h-10 items-center">
            <Switch
              checked={enabled}
              onCheckedChange={(v) => onChange({ ...assistant, enabled: v })}
            />
          </div>
        </div>
      </div>
      {/* 2. Description (Handoff Prompt) */}
      <div className="space-y-2">
        <div className="flex flex-col space-y-1">
          <Label>{t("routingDescription")}</Label>
          <span className="text-xs text-muted-foreground">
            {t("routingHelp")}
          </span>
        </div>
        <Textarea
          className="resize-y"
          placeholder={t("routingPlaceholder")}
          value={assistant.description || ""}
          onChange={(e) =>
            onChange({ ...assistant, description: e.target.value })
          }
        />
      </div>
      {/* 3. Instructions (System Prompt) */}
      <div className="space-y-2">
        <div className="flex flex-col space-y-1">
          <Label>{t("instructions")}</Label>
          <span className="text-xs text-muted-foreground">
            {t("instructionsHelp")}
          </span>
        </div>
        <Textarea
          className="min-h-[200px] font-mono text-sm leading-relaxed" // 使用等宽字体和较大的高度
          placeholder={t("instructionsPlaceholder")}
          value={assistant.instructions || ""}
          onChange={(e) =>
            onChange({ ...assistant, instructions: e.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <Label>{t("modelConfiguration")}</Label>
        <p className="text-sm text-muted-foreground mb-2">{t("modelHelp")}</p>
        <ModelSelector
          models={availableModels}
          value={assistant.model_config_id || null}
          onChange={(modelId) =>
            onChange({ ...assistant, model_config_id: modelId })
          }
          placeholder={t("useDefaultModel")}
          allowClear={true}
        />
      </div>
      <Separator />
      <div className="flex items-center justify-start gap-4">
        <h3 className="text-base font-semibold">{t("plugins")}</h3>
        <div className="flex gap-2">
          <SearchableSelect
            options={addable}
            value={selectedPluginIdToAdd}
            onChange={setSelectedPluginIdToAdd}
            placeholder={t("selectPlugin")}
            className="min-w-[160px] sm:min-w-[220px]"
          />
          <Button
            disabled={!selectedPluginIdToAdd || isCurrentlyAdding}
            onClick={() =>
              selectedPluginIdToAdd && onAddPlugin(selectedPluginIdToAdd)
            }
          >
            {isCurrentlyAdding && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isCurrentlyAdding ? common("adding") : common("add")}
          </Button>
        </div>
      </div>
      {!assistant.plugins?.length && (
        <div className="text-muted-foreground mt-2 text-sm">
          {t("noPlugins")}
        </div>
      )}
      <div className="space-y-4">
        {(assistant.plugins || []).map((p, j) => {
          // --- Logic to check if THIS plugin is the one being removed ---
          const isCurrentlyRemoving =
            isRemovingPlugin &&
            removingPluginDetails?.assistantId === assistant.id &&
            removingPluginDetails?.pluginId === p.registry_id;

          return (
            <PluginEditor
              key={p.registry_id}
              plugin={p}
              onChange={(np) => {
                const next = structuredClone(assistant) as Assistant;
                next.plugins = next.plugins || [];
                next.plugins[j] = np;
                onChange(next);
              }}
              onRemove={() => onRemovePlugin(p.registry_id)}
              // --- Pass the calculated boolean down ---
              isRemoving={isCurrentlyRemoving}
            />
          );
        })}
      </div>
    </div>
  );
}
