"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  PlusCircle,
  Save,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  LLMModelConfig,
  LLMModelConfigCreate,
  LLMModelConfigUpdate,
  TestConnectionRequest,
  TestConnectionResponse,
} from "@/types/entity";

interface ModelConfigDialogProps {
  model?: LLMModelConfig;
  isPending: boolean;
  onSave: (data: LLMModelConfigCreate | LLMModelConfigUpdate) => void;
  onTestConnection?: (
    data: TestConnectionRequest,
  ) => Promise<TestConnectionResponse>;
  trigger?: React.ReactNode;
}

interface ProviderOption {
  value: string;
  label: string;
  apiBase?: string;
  openAICompatible?: boolean;
}

const PROVIDERS: ProviderOption[] = [
  { value: "openai", label: "OpenAI" },
  { value: "azure", label: "Azure OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "ollama", label: "Ollama" },
  { value: "gemini", label: "Google Gemini" },
  {
    value: "deepseek",
    label: "DeepSeek",
    apiBase: "https://api.deepseek.com",
    openAICompatible: true,
  },
  {
    value: "qwen",
    label: "Qwen (Alibaba Cloud)",
    apiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    openAICompatible: true,
  },
  {
    value: "zhipu",
    label: "Zhipu GLM",
    apiBase: "https://open.bigmodel.cn/api/paas/v4/",
    openAICompatible: true,
  },
  {
    value: "moonshot",
    label: "Moonshot Kimi",
    apiBase: "https://api.moonshot.cn/v1",
    openAICompatible: true,
  },
  {
    value: "siliconflow",
    label: "SiliconFlow",
    apiBase: "https://api.siliconflow.cn/v1",
    openAICompatible: true,
  },
  {
    value: "openai-compatible",
    label: "OpenAI-compatible",
    openAICompatible: true,
  },
];

export function ModelConfigDialog({
  model,
  isPending,
  onSave,
  onTestConnection,
  trigger,
}: ModelConfigDialogProps) {
  const t = useTranslations("Models");
  const common = useTranslations("Common");
  const [open, setOpen] = useState(false);

  // 1. 新增：专门用于存储 Parameters 文本域的字符串状态
  const [jsonParams, setJsonParams] = useState("{}");
  // 2. 新增：用于显示 JSON 解析错误的提示
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [data, setData] = useState<LLMModelConfigCreate>({
    name: "",
    provider: "openai",
    model: "",
    api_base: "",
    api_version: "",
    api_key: "",
    is_active: true,
    parameters: {},
  });

  const [testResult, setTestResult] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message: string;
    latency?: number;
  }>({ status: "idle", message: "" });

  useEffect(() => {
    if (model) {
      setData({
        name: model.name,
        provider: model.provider,
        model: model.model,
        api_base: model.api_base || "",
        api_version: model.api_version || "",
        api_key: "",
        is_active: model.is_active,
        parameters: model.parameters || {},
      });
      // 初始化 JSON 字符串
      setJsonParams(JSON.stringify(model.parameters || {}, null, 2));
    } else {
      setData({
        name: "",
        provider: "openai",
        model: "",
        api_base: "",
        api_version: "",
        api_key: "",
        is_active: true,
        parameters: {},
      });
      // 初始化为空 JSON
      setJsonParams("{}");
    }
    setJsonError(null);
    setTestResult({ status: "idle", message: "" });
  }, [model, open]);

  // 辅助函数：尝试解析 JSON
  const parseParams = (): Record<string, any> | null => {
    try {
      const parsed = JSON.parse(jsonParams);
      setJsonError(null);
      return parsed;
    } catch (e) {
      setJsonError(t("invalidJson"));
      return null;
    }
  };

  const handleSubmit = () => {
    // 提交前解析 JSON
    const parsedParams = parseParams();
    if (parsedParams === null) return; // 如果解析失败，阻止提交

    // 将解析后的 parameters 合并到 data 中
    onSave({ ...data, parameters: parsedParams });
    setOpen(false);
  };

  const handleTest = async () => {
    if (!onTestConnection) return;

    // 测试连接前也需要解析 JSON，确保测试使用的是最新参数
    const parsedParams = parseParams();
    if (parsedParams === null) return;

    setTestResult({ status: "testing", message: t("testing") });
    try {
      const result = await onTestConnection({
        ...data,
        parameters: parsedParams,
      });
      setTestResult({
        status: result.success ? "success" : "error",
        message: result.message,
        latency: result.latency_ms,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : t("testFailed");
      setTestResult({
        status: "error",
        message: errorMessage,
      });
    }
  };

  const handleProviderChange = (provider: string) => {
    const currentProvider = PROVIDERS.find(
      (option) => option.value === data.provider,
    );
    const nextProvider = PROVIDERS.find(
      (option) => option.value === provider,
    );
    const shouldUsePreset =
      !data.api_base || data.api_base === currentProvider?.apiBase;

    setData({
      ...data,
      provider,
      api_base: shouldUsePreset ? nextProvider?.apiBase || "" : data.api_base,
      api_version: provider === "azure" ? data.api_version : "",
    });
  };

  const selectedProvider = PROVIDERS.find(
    (option) => option.value === data.provider,
  );
  const isValid = data.name && data.provider && data.model;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" /> {t("addModel")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{model ? t("editTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("configName")}</Label>
              <Input
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder={t("configNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("providerRequired")}</Label>
              <Select
                value={data.provider}
                onValueChange={handleProviderChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("modelName")}</Label>
            <Input
              value={data.model}
              onChange={(e) => setData({ ...data, model: e.target.value })}
              placeholder={t("modelNamePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{model ? t("apiKeyKeep") : t("apiKey")}</Label>
            <Input
              type="password"
              value={data.api_key || ""}
              onChange={(e) => setData({ ...data, api_key: e.target.value })}
              placeholder={model ? "••••••••" : t("apiKeyPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("apiBaseOptional")}</Label>
            <Input
              value={data.api_base || ""}
              onChange={(e) => setData({ ...data, api_base: e.target.value })}
              placeholder={t("apiBasePlaceholder")}
            />
            {selectedProvider?.openAICompatible && (
              <p className="text-xs text-muted-foreground">
                {t("openAiCompatibleHelp")}
              </p>
            )}
          </div>

          {data.provider === "azure" && (
            <div className="space-y-2">
              <Label>{t("apiVersion")}</Label>
              <Input
                value={data.api_version || ""}
                onChange={(e) =>
                  setData({ ...data, api_version: e.target.value })
                }
                placeholder="e.g., 2024-02-15-preview"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("parameters")}</Label>
            {/* 修改处：使用 value 和 onChange 绑定 jsonParams 状态 */}
            <textarea
              className={`w-full min-h-[100px] px-3 py-2 text-sm border bg-background rounded-md resize-vertical focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent ${
                jsonError ? "border-red-500 focus:ring-red-500" : "border-input"
              }`}
              value={jsonParams}
              onChange={(e) => {
                setJsonParams(e.target.value);
                setJsonError(null); // 用户输入时清除错误提示
              }}
              placeholder='{"temperature": 0.7, "max_tokens": 1000}'
            />
            {jsonError ? (
              <p className="text-xs text-red-500">{jsonError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("parameterHelp", {
                  example: '{"temperature": 0.7, "max_tokens": 1000}',
                })}
              </p>
            )}
          </div>

          {testResult.status !== "idle" && (
            <Alert
              variant={
                testResult.status === "success"
                  ? "default"
                  : testResult.status === "error"
                    ? "destructive"
                    : "default"
              }
            >
              {testResult.status === "success" && (
                <CheckCircle className="h-4 w-4" />
              )}
              {testResult.status === "error" && (
                <AlertCircle className="h-4 w-4" />
              )}
              {testResult.status === "testing" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <AlertDescription>
                {testResult.message}
                {testResult.latency && ` (${testResult.latency}ms)`}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className="gap-2">
          {onTestConnection && (
            <Button
              onClick={handleTest}
              variant="outline"
              disabled={!isValid || testResult.status === "testing"}
            >
              {testResult.status === "testing" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertCircle className="mr-2 h-4 w-4" />
              )}
              {t("testConnection")}
            </Button>
          )}
          {/* 如果 JSON 格式错误，禁用保存按钮 */}
          <Button
            onClick={handleSubmit}
            disabled={isPending || !isValid || !!jsonError}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : model ? (
              <Save className="mr-2 h-4 w-4" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            {isPending
              ? common("saving")
              : model
                ? common("update")
                : common("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
