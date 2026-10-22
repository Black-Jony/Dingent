"use client";

import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useAgent,
  CopilotChat,
  useCopilotKit,
  type AttachmentsConfig,
  type CopilotChatMessageViewProps,
  type Message,
} from "@copilotkit/react-core/v2";
import { useRenderToolCall } from "@copilotkit/react-core";
import { toast } from "sonner";

import { Loader2 } from "lucide-react";
import { ThinkingTextMessageContentEvent } from "@ag-ui/client";

import { useThreadContext } from "@/providers/ThreadProvider";
import { ChatHeader } from "@/features/chat/chat-header";
import {
  useActiveWorkflow,
  useApplyWorkflowFromUrl,
} from "@/features/workflows/hooks";
import { getClientApi } from "@/lib/api/client";
import { ThinkingProvider, useThinking } from "@/providers/ThinkingProvider";
import { useTranslations } from "next-intl";
import { ChatStarterSuggestions } from "./ChatStarterSuggestions";
import { DingentChatMessageView } from "./DingentChatMessageView";
import {
  RunProgressContext,
  type RunProgressState,
  type ExecutionStep,
  type ExecutionTraceData,
} from "./ThinkingAccordion";
import {
  AnalysisWorkspaceProvider,
  AnalysisWorkspaceSlot,
  useAnalysisWorkspace,
} from "./AnalysisWorkspace";

interface ChatPageProps {
  isGuest?: boolean;
  visitorId?: string;
  slug?: string;
}

interface ChatTimingStats {
  agentName: string;
  threadId: string | null;
  runId?: string;
  startedAtMs: number;
  firstEventAtMs?: number;
  runStartedAtMs?: number;
  firstThinkingAtMs?: number;
  firstActivityAtMs?: number;
  firstTextStartAtMs?: number;
  firstTokenAtMs?: number;
  finishedAtMs?: number;
  textDeltaCount: number;
  textCharCount: number;
  thinkingDeltaCount: number;
  thinkingCharCount: number;
  activityCount: number;
  toolCallCount: number;
}

const CHAT_IMAGE_ATTACHMENTS = {
  enabled: true,
  accept: "image/png,image/jpeg,image/webp",
  maxSize: 5 * 1024 * 1024,
  onUploadFailed: ({ message }) => toast.error(message),
} satisfies AttachmentsConfig;

function elapsedMs(startMs: number, endMs?: number) {
  return typeof endMs === "number"
    ? Math.round((endMs - startMs) * 100) / 100
    : null;
}

function getDeltaLength(delta: unknown) {
  return typeof delta === "string" ? delta.length : 0;
}

function mergeStreamingActivities(
  messages: Message[],
  streamingActivities: Message[],
) {
  const knownIds = new Set(messages.map((message) => message.id));
  const missingActivities = streamingActivities.filter(
    (message) => !knownIds.has(message.id),
  );
  if (missingActivities.length === 0) return messages;

  let lastUserIndex = -1;
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index].role === "user") lastUserIndex = index;
  }

  const assistantIndex = messages.findIndex(
    (message, index) => index > lastUserIndex && message.role === "assistant",
  );
  const insertIndex = assistantIndex === -1 ? messages.length : assistantIndex;

  return [
    ...messages.slice(0, insertIndex),
    ...missingActivities,
    ...messages.slice(insertIndex),
  ];
}

function insertRunProgressMessage(
  messages: Message[],
  progressText: string,
  isRunning: boolean,
  threadId: string,
  trace: ExecutionTraceData = {},
) {
  const content = progressText.trim();
  if (
    !isRunning &&
    !content &&
    !trace.executionSteps?.length &&
    !trace.executionFailed &&
    !trace.executionStopped
  )
    return messages;

  let lastUserIndex = -1;
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index].role === "user") lastUserIndex = index;
  }

  const progressMessage = {
    id: `dingent-run-progress-${threadId}`,
    role: "assistant",
    content: `<thinking>${content}</thinking>`,
    ...trace,
  } as Message;
  const insertIndex = lastUserIndex + 1;

  return [
    ...messages.slice(0, insertIndex),
    progressMessage,
    ...messages.slice(insertIndex),
  ];
}

function humanizeToolName(toolName: string) {
  return toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getActivityLabel(content: unknown): string | undefined {
  if (Array.isArray(content)) {
    for (const item of content) {
      const label = getActivityLabel(item);
      if (label) return label;
    }
    return undefined;
  }
  if (!content || typeof content !== "object") return undefined;

  const activity = content as Record<string, unknown>;
  const summary = activity.summary;
  const associationTable = activity.association_table;
  return (
    (typeof activity.title === "string" && activity.title) ||
    (typeof activity.label === "string" && activity.label) ||
    (summary &&
    typeof summary === "object" &&
    typeof (summary as Record<string, unknown>).trait_name === "string"
      ? String((summary as Record<string, unknown>).trait_name)
      : undefined) ||
    (associationTable &&
    typeof associationTable === "object" &&
    typeof (associationTable as Record<string, unknown>).title === "string"
      ? String((associationTable as Record<string, unknown>).title)
      : undefined)
  );
}

function ChatPageContent({ isGuest, visitorId, slug }: ChatPageProps) {
  const t = useTranslations("Chat");
  const translationsRef = useRef(t);
  translationsRef.current = t;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryParam = searchParams.get("query")?.trim() || "";
  const workflowParam = searchParams.get("workflow")?.trim() || "";
  const handledQueryRef = useRef<string | null>(null);
  const handledWorkflowRef = useRef<string | null>(null);

  const api = getClientApi().forWorkspace(slug, { isGuest, visitorId });
  useApplyWorkflowFromUrl(api.workflows, slug);
  const { workflow } = useActiveWorkflow(api.workflows, slug);

  const { activeThreadId, updateThreadTitle } = useThreadContext();
  const { artifact, closeArtifact } = useAnalysisWorkspace();
  const copilotLabels = {
    chatInputPlaceholder: t("copilot.placeholder"),
    chatInputToolbarStartTranscribeButtonLabel: t("copilot.transcribe"),
    chatInputToolbarCancelTranscribeButtonLabel: t("copilot.cancel"),
    chatInputToolbarFinishTranscribeButtonLabel: t("copilot.finish"),
    chatInputToolbarAddButtonLabel: t("copilot.addAttachments"),
    chatInputToolbarToolsButtonLabel: t("copilot.tools"),
    assistantMessageToolbarCopyCodeLabel: t("copilot.copy"),
    assistantMessageToolbarCopyCodeCopiedLabel: t("copilot.copied"),
    assistantMessageToolbarCopyMessageLabel: t("copilot.copy"),
    assistantMessageToolbarThumbsUpLabel: t("copilot.goodResponse"),
    assistantMessageToolbarThumbsDownLabel: t("copilot.badResponse"),
    assistantMessageToolbarReadAloudLabel: t("copilot.readAloud"),
    assistantMessageToolbarRegenerateLabel: t("copilot.regenerate"),
    userMessageToolbarCopyMessageLabel: t("copilot.copy"),
    userMessageToolbarEditMessageLabel: t("copilot.edit"),
    chatDisclaimerText: t("copilot.disclaimer"),
    chatToggleOpenLabel: t("copilot.open"),
    chatToggleCloseLabel: t("copilot.close"),
    modalHeaderTitle: t("copilot.title"),
    welcomeMessageText: t("copilot.welcome"),
  };

  const agentName = workflow?.name || "default";
  const agent = useAgent({ agentId: agentName });
  const { copilotkit } = useCopilotKit();
  const isAgentRunning = agent.agent.isRunning;
  const messages = agent.agent.messages;
  const starterQuestions = useMemo(
    () => [
      {
        id: "capabilities",
        prompt: t("starter.capabilities", {
          agent: workflow?.name || agentName,
        }),
      },
      { id: "summary", prompt: t("starter.summary") },
      { id: "analysis", prompt: t("starter.analysis") },
    ],
    [agentName, t, workflow?.name],
  );
  const [urlQuestionMessage, setUrlQuestionMessage] = useState<{
    threadId: string;
    message: Message;
  } | null>(null);
  const [isUrlAutoAsking, setIsUrlAutoAsking] = useState(false);
  const pendingLaunchRef = useRef<symbol | null>(null);
  const [runHasEnded, setRunHasEnded] = useState(false);
  const activeThreadIdRef = useRef(activeThreadId);
  const urlQuestionMessageRef = useRef(urlQuestionMessage);
  const isUrlAutoAskingRef = useRef(isUrlAutoAsking);
  const activityMessagesRef = useRef<any[]>([]);
  const starterQuestionsRef = useRef(starterQuestions);
  const submitStarterQuestionRef = useRef<(prompt: string) => void>(() => {});

  activeThreadIdRef.current = activeThreadId;
  urlQuestionMessageRef.current = urlQuestionMessage;
  isUrlAutoAskingRef.current = isUrlAutoAsking;
  starterQuestionsRef.current = starterQuestions;

  const removeLaunchParams = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("workflow");
    nextParams.delete("query");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);
  const timingStatsRef = useRef<ChatTimingStats | null>(null);
  const [streamingActivityMessages, setStreamingActivityMessages] = useState<
    any[]
  >([]);
  activityMessagesRef.current = streamingActivityMessages;
  const processStepNumberRef = useRef(0);
  const meaningfulProcessStepCountRef = useRef(0);
  const recordedProcessEventsRef = useRef(new Set<string>());
  const toolCallLabelsRef = useRef(new Map<string, string>());
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [executionFailed, setExecutionFailed] = useState(false);
  const [executionStopped, setExecutionStopped] = useState(false);

  const {
    thinkingText,
    appendThinkingText,
    clearThinkingText,
    isThinking,
    setIsThinking,
  } = useThinking();
  const progressState: RunProgressState = {
    messageId: `dingent-run-progress-${activeThreadId || "current"}`,
    thinkingText,
    isThinking,
    runHasEnded,
    executionSteps,
    executionFailed,
    executionStopped,
  };
  const completeExecutionStep = useCallback((id: string, detail?: string) => {
    setExecutionSteps((previous) => {
      if (!previous.some((step) => step.id === id)) return previous;
      return previous.map((step) =>
        step.id === id
          ? { ...step, status: "complete", detail: detail ?? step.detail }
          : step,
      );
    });
  }, []);
  const appendProcessStep = useCallback(
    (content: string) => {
      const normalized = content.trim();
      if (!normalized) return;
      processStepNumberRef.current += 1;
      appendThinkingText(
        `\n\n${translationsRef.current("thinking.step", {
          number: processStepNumberRef.current,
          content: normalized,
        })}`,
      );
    },
    [appendThinkingText],
  );
  useRenderToolCall(
    {
      name: "write_todos",
      // Suppress both the plan card and the default tool-result display.
      render: () => null,
    },
    [],
  );
  useEffect(() => {
    setStreamingActivityMessages([]);
    setUrlQuestionMessage(null);
    setIsUrlAutoAsking(false);
    pendingLaunchRef.current = null;
    setRunHasEnded(false);
    setExecutionSteps([]);
    setExecutionFailed(false);
    setExecutionStopped(false);
    closeArtifact();
    clearThinkingText();
    setIsThinking(false);
    processStepNumberRef.current = 0;
    meaningfulProcessStepCountRef.current = 0;
    recordedProcessEventsRef.current.clear();
    toolCallLabelsRef.current.clear();
    timingStatsRef.current = null;
  }, [
    activeThreadId,
    agentName,
    clearThinkingText,
    closeArtifact,
    setIsThinking,
  ]);
  useEffect(() => {
    if (!agent.agent) return;
    let subscribed = true;

    const ensureTimingStats = (event: any) => {
      if (!timingStatsRef.current) {
        timingStatsRef.current = {
          agentName,
          threadId: activeThreadId,
          runId: event.runId || event.run_id,
          startedAtMs: performance.now(),
          textDeltaCount: 0,
          textCharCount: 0,
          thinkingDeltaCount: 0,
          thinkingCharCount: 0,
          activityCount: 0,
          toolCallCount: 0,
        };
      }

      return timingStatsRef.current;
    };

    const logTimingStats = (event: any) => {
      const stats = timingStatsRef.current;
      if (!stats) return;

      stats.finishedAtMs = performance.now();
      const baselineMs = stats.runStartedAtMs ?? stats.startedAtMs;
      console.info("[Dingent] chat response timings", {
        agentName: stats.agentName,
        threadId: stats.threadId,
        runId: stats.runId || event.runId || event.run_id,
        terminalEvent: event.type,
        totalDurationMs: elapsedMs(stats.startedAtMs, stats.finishedAtMs),
        firstEventMs: elapsedMs(stats.startedAtMs, stats.firstEventAtMs),
        runStartDelayMs: elapsedMs(stats.startedAtMs, stats.runStartedAtMs),
        timeToFirstThinkingMs: elapsedMs(baselineMs, stats.firstThinkingAtMs),
        timeToFirstActivityMs: elapsedMs(baselineMs, stats.firstActivityAtMs),
        timeToFirstTextStartMs: elapsedMs(baselineMs, stats.firstTextStartAtMs),
        timeToFirstTokenMs: elapsedMs(baselineMs, stats.firstTokenAtMs),
        textStreamDurationMs: elapsedMs(
          stats.firstTokenAtMs ?? baselineMs,
          stats.finishedAtMs,
        ),
        textDeltaCount: stats.textDeltaCount,
        textCharCount: stats.textCharCount,
        thinkingDeltaCount: stats.thinkingDeltaCount,
        thinkingCharCount: stats.thinkingCharCount,
        activityCount: stats.activityCount,
        toolCallCount: stats.toolCallCount,
      });
      timingStatsRef.current = null;
    };

    const handleActivitySnapshot = (activityEvent: any) => {
      const messageId = activityEvent.messageId || activityEvent.message_id;
      if (messageId && activityEvent.content) {
        const eventKey = `activity:${messageId}`;
        if (!recordedProcessEventsRef.current.has(eventKey)) {
          recordedProcessEventsRef.current.add(eventKey);
          const stats = ensureTimingStats(activityEvent);
          stats.activityCount += 1;
          stats.firstActivityAtMs ??= performance.now();
          const toolCallId = String(messageId).replace(
            /:activity(?::\d+)?$/,
            "",
          );
          const label =
            toolCallLabelsRef.current.get(toolCallId) ||
            getActivityLabel(activityEvent.content);
          const resultStepKey = `result:${toolCallId}`;
          if (
            label &&
            label !== humanizeToolName("write_todos") &&
            !recordedProcessEventsRef.current.has(resultStepKey)
          ) {
            recordedProcessEventsRef.current.add(resultStepKey);
            meaningfulProcessStepCountRef.current += 1;
            appendProcessStep(
              translationsRef.current("thinking.result", { name: label }),
            );
            const detail = translationsRef.current("thinking.result", {
              name: label,
            });
            if (toolCallLabelsRef.current.has(toolCallId)) {
              completeExecutionStep(toolCallId, detail);
            } else {
              setExecutionSteps((previous) => [
                ...previous,
                { id: resultStepKey, label: detail, status: "complete" },
              ]);
            }
          }
        }
        setStreamingActivityMessages((prevMessages) => {
          const nextMessages = prevMessages.filter(
            (message) => message.id !== messageId,
          );
          return [
            ...nextMessages,
            {
              id: messageId,
              role: "activity",
              activityType:
                activityEvent.activityType ||
                activityEvent.activity_type ||
                "a2ui-surface",
              content: activityEvent.content,
            },
          ];
        });
      }
    };

    const handleToolCallStart = (toolEvent: any) => {
      const toolName =
        toolEvent.toolCallName ||
        toolEvent.tool_call_name ||
        toolEvent.name ||
        "tool";
      const toolCallId = String(
        toolEvent.toolCallId || toolEvent.tool_call_id || toolName,
      );
      const eventKey = `tool:${toolCallId}`;
      if (recordedProcessEventsRef.current.has(eventKey)) return;

      recordedProcessEventsRef.current.add(eventKey);
      const stats = ensureTimingStats(toolEvent);
      stats.toolCallCount += 1;
      const displayName = humanizeToolName(String(toolName));
      toolCallLabelsRef.current.set(toolCallId, displayName);
      if (toolName === "write_todos") return;
      meaningfulProcessStepCountRef.current += 1;
      setExecutionSteps((previous) => [
        ...previous,
        {
          id: toolCallId,
          toolName: String(toolName),
          label: translationsRef.current("thinking.tool", {
            name: displayName,
          }),
          status: "running",
        },
      ]);
      appendProcessStep(
        translationsRef.current("thinking.tool", { name: displayName }),
      );
    };

    const thinkingSubscriber = {
      onRunFinalized: () => {
        if (!subscribed) return undefined;
        setRunHasEnded(true);
        setIsThinking(false);
        setIsUrlAutoAsking(false);
        return undefined;
      },
      onRunFailed: () => {
        if (!subscribed) return undefined;
        setRunHasEnded(true);
        setExecutionFailed(true);
        setIsThinking(false);
        setIsUrlAutoAsking(false);
        return undefined;
      },
      onToolCallStartEvent: ({ event }: { event: any }) => {
        if (!subscribed) return undefined;
        handleToolCallStart(event);
        return undefined;
      },
      onActivitySnapshotEvent: ({ event }: { event: any }) => {
        if (!subscribed) return undefined;
        handleActivitySnapshot(event);
        return undefined;
      },
      onEvent: ({ event }) => {
        if (!subscribed) return undefined;
        const stats = ensureTimingStats(event);
        stats.firstEventAtMs ??= performance.now();
        stats.runId = stats.runId || event.runId || event.run_id;

        if (event.type === "RUN_STARTED") {
          setRunHasEnded(false);
          setExecutionSteps([]);
          setExecutionFailed(false);
          setExecutionStopped(false);
          stats.runStartedAtMs ??= performance.now();
          processStepNumberRef.current = 0;
          meaningfulProcessStepCountRef.current = 0;
          recordedProcessEventsRef.current.clear();
          toolCallLabelsRef.current.clear();
          clearThinkingText();
          setIsThinking(true);
        } else if (event.type === "TOOL_CALL_RESULT") {
          const callId = String(event.toolCallId || event.tool_call_id || "");
          completeExecutionStep(callId);
        } else if (event.type === "THINKING_START") {
          stats.firstThinkingAtMs ??= performance.now();
        } else if (event.type === "TEXT_MESSAGE_START") {
          stats.firstTextStartAtMs ??= performance.now();
        } else if (event.type === "TEXT_MESSAGE_CONTENT") {
          stats.firstTokenAtMs ??= performance.now();
          stats.textDeltaCount += 1;
          stats.textCharCount += getDeltaLength(event.delta);
        }

        if (event.type === "THINKING_TEXT_MESSAGE_CONTENT") {
          const thinkingEvent = event as ThinkingTextMessageContentEvent;
          const isFirstThinkingDelta = stats.thinkingDeltaCount === 0;
          stats.thinkingDeltaCount += 1;
          stats.thinkingCharCount += getDeltaLength(thinkingEvent.delta);
          appendThinkingText(
            `${isFirstThinkingDelta ? "\n\n" : ""}${thinkingEvent.delta}`,
          );
        } else if (event.type === "THINKING_START") {
          setIsThinking(true);
        } else if (
          event.type === "THINKING_END" ||
          event.type === "RUN_FINISHED" ||
          event.type === "RUN_ERROR"
        ) {
          setIsThinking(false);
        }
        if (event.type === "RUN_FINISHED" || event.type === "RUN_ERROR") {
          setRunHasEnded(true);
          setExecutionFailed(event.type === "RUN_ERROR");
          setIsUrlAutoAsking(false);
          if (
            meaningfulProcessStepCountRef.current === 0 &&
            stats.thinkingDeltaCount === 0
          ) {
            clearThinkingText();
          }
          logTimingStats(event);
        }
        return undefined;
      },
    };

    const subscription = agent.agent.subscribe(
      thinkingSubscriber as Parameters<typeof agent.agent.subscribe>[0],
    );
    return () => {
      // Active streams can retain a snapshot of subscribers after unsubscribe.
      subscribed = false;
      subscription.unsubscribe();
    };
  }, [
    activeThreadId,
    agent.agent,
    agentName,
    appendProcessStep,
    appendThinkingText,
    completeExecutionStep,
    clearThinkingText,
    setIsThinking,
  ]);

  const stopCurrentRun = useCallback(async () => {
    pendingLaunchRef.current = null;
    setRunHasEnded(true);
    setExecutionStopped(true);
    setIsThinking(false);
    setIsUrlAutoAsking(false);
    try {
      copilotkit.stopAgent({ agent: agent.agent });
    } catch (error) {
      console.error("Stopping the agent failed", error);
    }
    try {
      // Server-side stop support must not keep the local stream alive.
      await agent.agent.detachActiveRun();
    } catch (error) {
      console.error("Detaching the stopped chat stream failed", error);
    }
  }, [agent.agent, copilotkit, setIsThinking]);

  useEffect(() => {
    if (activeThreadId) {
      updateThreadTitle();
    }
  }, [isAgentRunning, activeThreadId, updateThreadTitle]);

  useEffect(() => {
    const handleSwitchSpecies = async (event: Event) => {
      const speciesName = (
        (event as CustomEvent<{ speciesName?: string }>).detail?.speciesName ||
        ""
      ).trim();
      if (!speciesName || !activeThreadId || agent.agent.isRunning) return;

      try {
        agent.agent.threadId = activeThreadId;
        agent.agent.addMessage({
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "user",
          content: `query species = ${speciesName}`,
        } as Message);
        await copilotkit.runAgent({ agent: agent.agent });
      } catch (error) {
        console.error("gwas switch species failed", error);
      }
    };

    window.addEventListener("gwas-switch-species", handleSwitchSpecies);
    return () => {
      window.removeEventListener("gwas-switch-species", handleSwitchSpecies);
    };
  }, [activeThreadId, agent.agent, copilotkit]);

  useEffect(() => {
    if (!queryParam || !activeThreadId || agent.agent.isRunning) return;
    if (
      workflowParam &&
      workflow?.name.toLowerCase() !== workflowParam.toLowerCase()
    ) {
      return;
    }

    const launchKey = `${activeThreadId}:${workflowParam}:${queryParam}`;
    if (handledQueryRef.current === launchKey) return;
    handledQueryRef.current = launchKey;

    const runUrlQuestion = async () => {
      const launchToken = Symbol("url-question");
      pendingLaunchRef.current = launchToken;
      const userMessage: Message = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content: queryParam,
      };

      try {
        setUrlQuestionMessage({
          threadId: activeThreadId,
          message: userMessage,
        });
        setIsUrlAutoAsking(true);
        agent.agent.threadId = activeThreadId;
        agent.agent.addMessage(userMessage);
        removeLaunchParams();
        await copilotkit.runAgent({ agent: agent.agent });
      } catch (error) {
        console.error("auto-ask from url failed", error);
      } finally {
        if (pendingLaunchRef.current === launchToken) {
          pendingLaunchRef.current = null;
          setIsUrlAutoAsking(false);
        }
      }
    };

    void runUrlQuestion();
  }, [
    activeThreadId,
    agent.agent,
    copilotkit,
    queryParam,
    removeLaunchParams,
    workflow,
    workflowParam,
  ]);

  useEffect(() => {
    if (queryParam || !workflowParam || !activeThreadId) return;
    if (workflow?.name.toLowerCase() !== workflowParam.toLowerCase()) return;

    const launchKey = `${activeThreadId}:${workflowParam}`;
    if (handledWorkflowRef.current === launchKey) return;
    handledWorkflowRef.current = launchKey;
    removeLaunchParams();
  }, [activeThreadId, queryParam, removeLaunchParams, workflow, workflowParam]);

  const submitStarterQuestion = useCallback(
    async (prompt: string) => {
      const question = prompt.trim();
      if (!question || !activeThreadId || agent.agent.isRunning) return;
      const launchToken = Symbol("starter-question");
      pendingLaunchRef.current = launchToken;

      const userMessage: Message = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content: question,
      };

      try {
        setUrlQuestionMessage({
          threadId: activeThreadId,
          message: userMessage,
        });
        setIsUrlAutoAsking(true);
        agent.agent.threadId = activeThreadId;
        agent.agent.addMessage(userMessage);
        await copilotkit.runAgent({ agent: agent.agent });
      } catch (error) {
        console.error("starter question failed", error);
      } finally {
        if (pendingLaunchRef.current === launchToken) {
          pendingLaunchRef.current = null;
          setIsUrlAutoAsking(false);
        }
      }
    },
    [activeThreadId, agent.agent, copilotkit],
  );
  submitStarterQuestionRef.current = (prompt: string) => {
    void submitStarterQuestion(prompt);
  };

  const messageView = useMemo(() => {
    function UrlAwareMessageView(props: CopilotChatMessageViewProps) {
      // Context updates cross CopilotKit's memoized slot without remounting it.
      const progress = useContext(RunProgressContext);
      if (!progress) return null;
      const currentThreadId = activeThreadIdRef.current;
      const urlQuestion = urlQuestionMessageRef.current;
      const visibleMessages = mergeStreamingActivities(
        props.messages || [],
        activityMessagesRef.current as Message[],
      );
      const shouldShowUrlQuestion =
        urlQuestion?.threadId === currentThreadId &&
        !visibleMessages.some(
          (message) =>
            message.role === "user" &&
            (message.id === urlQuestion.message.id ||
              message.content === urlQuestion.message.content),
        );
      const shouldShowUrlRunning =
        isUrlAutoAskingRef.current && urlQuestion?.threadId === currentThreadId;
      const renderedMessages = shouldShowUrlQuestion
        ? [urlQuestion.message, ...visibleMessages]
        : visibleMessages;
      const runIsActive =
        !progress.runHasEnded &&
        (props.isRunning || shouldShowUrlRunning || progress.isThinking);
      const hasUserMessage = renderedMessages.some(
        (message) =>
          message.role === "user" &&
          String(message.content || "").trim().length > 0,
      );
      const orderedMessages = hasUserMessage
        ? insertRunProgressMessage(
            renderedMessages,
            progress.thinkingText,
            runIsActive,
            currentThreadId || "current",
            {
              executionSteps: progress.executionSteps,
              executionFailed: progress.executionFailed,
              executionStopped: progress.executionStopped,
            },
          )
        : renderedMessages;
      const hasConversation = renderedMessages.some(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          String(message.content || "").trim().length > 0,
      );

      return (
        <div className="min-h-full">
          {!hasConversation && (
            <ChatStarterSuggestions
              disabled={props.isRunning || shouldShowUrlRunning}
              heading={t("copilot.welcome")}
              questions={starterQuestionsRef.current}
              onSelect={(prompt) => submitStarterQuestionRef.current(prompt)}
            />
          )}
          <DingentChatMessageView
            {...props}
            isRunning={runIsActive}
            messages={orderedMessages}
          />
        </div>
      );
    }

    const component = UrlAwareMessageView as typeof DingentChatMessageView;
    component.Cursor = DingentChatMessageView.Cursor;
    return component;
  }, [t]);

  if (isGuest && !visitorId) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeThreadId) return null;

  return (
    <main
      data-chat-workspace
      data-analysis-open={artifact ? "true" : "false"}
      className="grid h-svh min-h-0 w-full overflow-hidden bg-background"
    >
      <section
        data-chat-pane
        className="flex min-w-0 flex-col overflow-hidden bg-background"
      >
        <ChatHeader />
        <div data-dingent-chat className="min-h-0 flex-1 overflow-hidden">
          <RunProgressContext.Provider value={progressState}>
            <CopilotChat
              agentId={workflow?.name}
              threadId={activeThreadId}
              attachments={CHAT_IMAGE_ATTACHMENTS}
              labels={copilotLabels}
              messageView={messageView}
              onStop={stopCurrentRun}
              className="h-full min-h-0 w-full bg-background"
            />
          </RunProgressContext.Provider>
        </div>
      </section>
      <div
        data-analysis-column
        className="min-w-0 overflow-visible xl:overflow-hidden"
      >
        <AnalysisWorkspaceSlot />
      </div>
    </main>
  );
}

export function ChatPage({ isGuest = false, visitorId }: ChatPageProps) {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <ThinkingProvider>
      <AnalysisWorkspaceProvider>
        <Suspense
          fallback={
            <div className="flex h-screen w-full items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          }
        >
          <ChatPageContent
            isGuest={isGuest}
            visitorId={visitorId}
            slug={slug}
          />
        </Suspense>
      </AnalysisWorkspaceProvider>
    </ThinkingProvider>
  );
}
