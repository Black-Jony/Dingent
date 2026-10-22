"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Dispatch, SetStateAction } from "react";

import { v4 as uuidv4 } from "uuid";
import { getClientApi } from "@/lib/api/client";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { isAxiosError } from "axios";

export interface ChatThread {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface ThreadContextType {
  isLoading: boolean;
  threads: ChatThread[]; // Changed from threadIds: string[]
  activeThreadId: string | undefined;
  setActiveThreadId: Dispatch<SetStateAction<string>>;
  updateThreadTitle: () => void;
  deleteAllThreads: () => void;
}

const CURRENT_THREAD_ID_KEY = "currentChatThreadId";

interface ExtendedThreadContextType extends ThreadContextType {
  deleteThread: (id: string) => Promise<void>; // 变为异步
  createThread: () => void;
  refreshThreads: () => Promise<void>; // 新增：手动刷新列表
}

export const ThreadContext = createContext<
  ExtendedThreadContextType | undefined
>(undefined);

export const useThreadContext = () => {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error("useThreadContext must be used within a ThreadProvider");
  }
  return context;
};

interface ThreadProviderProps {
  children: React.ReactNode;
  visitorId?: string;
}

export function ThreadProvider({ children, visitorId }: ThreadProviderProps) {
  const common = useTranslations("Common");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [isInitializing, setIsInitializing] = useState(true);
  const params = useParams();
  const slug = params.slug as string;
  const api = useMemo(
    () => getClientApi().forWorkspace(slug, { visitorId }),
    [slug, visitorId],
  );
  const apiRef = useRef(api);
  const threadStateRef = useRef({ threads, activeThreadId });
  useEffect(() => {
    apiRef.current = api;
    threadStateRef.current = { threads, activeThreadId };
  }, [api, threads, activeThreadId]);
  const currentThreadStorageKey = `${CURRENT_THREAD_ID_KEY}:${slug}:${visitorId || "authenticated"}`;

  const fetchThreads = useCallback(async () => {
    try {
      const threads = await api.threads.list();
      return threads.map((t) => ({
        id: t.id,
        title: t.title,
        createdAt: new Date(t.created_at), // 转换字符串为 Date 对象
        updatedAt: new Date(t.updated_at),
      }));
    } catch (error) {
      console.error("Failed to fetch threads", error);
      return null;
    }
  }, [api.threads]);

  const createNewLocalThread = useCallback(() => {
    const newId = uuidv4();
    const newThread: ChatThread = {
      id: newId,
      title: "New Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newId);
    return newId;
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setIsInitializing(true);
      const serverThreads = (await fetchThreads()) ?? [];

      if (!mounted) return;

      setThreads(serverThreads);

      // 恢复上次选中的 ID
      const searchParams = new URLSearchParams(window.location.search);
      const isExternalLaunch =
        searchParams.has("workflow") || searchParams.has("query");
      const lastActiveId = localStorage.getItem(currentThreadStorageKey);

      if (isExternalLaunch) {
        createNewLocalThread();
      } else if (
        lastActiveId &&
        serverThreads.some((t) => t.id === lastActiveId)
      ) {
        // 如果本地存的 ID 在服务器列表里存在，就用它
        setActiveThreadId(lastActiveId);
      } else if (serverThreads.length > 0) {
        // 否则默认选中第一个
        setActiveThreadId(serverThreads[0]!.id);
      } else {
        // 如果服务器也没数据，创建一个全新的本地状态（此时还没存库）
        createNewLocalThread();
      }

      setIsInitializing(false);
    };

    init();

    return () => {
      mounted = false;
    };
  }, [createNewLocalThread, currentThreadStorageKey, fetchThreads]);

  // --- 4. 监听 Active ID 变化并存储偏好 ---
  useEffect(() => {
    if (activeThreadId) {
      localStorage.setItem(currentThreadStorageKey, activeThreadId);
    }
  }, [activeThreadId, currentThreadStorageKey]);

  const createThread = useCallback(() => {
    createNewLocalThread();
  }, [createNewLocalThread]);

  const updateThreadTitle = useCallback(async () => {
    const latestThreads = await fetchThreads();
    if (!latestThreads || apiRef.current !== api) return;
    setThreads((currentThreads) => {
      const activeLocalThread = currentThreads.find(
        (thread) =>
          thread.id === threadStateRef.current.activeThreadId &&
          !latestThreads.some((latestThread) => latestThread.id === thread.id),
      );
      return activeLocalThread
        ? [activeLocalThread, ...latestThreads]
        : latestThreads;
    });
  }, [api, fetchThreads]);

  const deleteThread = useCallback(
    async (id: string) => {
      try {
        await api.threads.delete(id).catch((error: unknown) => {
          // Empty local conversations may not have been persisted yet.
          if (
            !isAxiosError<{ detail?: string }>(error) ||
            error.response?.status !== 404 ||
            error.response.data?.detail !== "Thread not found"
          ) {
            throw error;
          }
        });
        if (apiRef.current !== api) return;
        setThreads((prev) => prev.filter((thread) => thread.id !== id));
        if (id === threadStateRef.current.activeThreadId) {
          const remaining = threadStateRef.current.threads.filter(
            (thread) => thread.id !== id,
          );
          if (remaining.length > 0) {
            setActiveThreadId(remaining[0].id);
          } else {
            createNewLocalThread();
          }
        }
      } catch (error) {
        console.error("Failed to delete thread", error);
        toast.error(common("error"));
      }
    },
    [api, common, createNewLocalThread],
  );

  const deleteAllThreads = useCallback(async () => {
    try {
      await api.threads.deleteAll();
      if (apiRef.current !== api) return;
      setThreads([]);
      createNewLocalThread();
    } catch (error) {
      console.error("Failed to clear threads", error);
      toast.error(common("error"));
    }
  }, [api, common, createNewLocalThread]);

  const value = useMemo(
    () => ({
      isLoading: isInitializing,
      threads,
      activeThreadId,
      setActiveThreadId,
      createThread,
      updateThreadTitle,
      deleteThread,
      deleteAllThreads,
      refreshThreads: async () => {
        const data = await fetchThreads();
        if (data && apiRef.current === api) setThreads(data);
      },
    }),
    [
      isInitializing,
      threads,
      activeThreadId,
      createThread,
      updateThreadTitle,
      deleteThread,
      deleteAllThreads,
      fetchThreads,
      api,
    ],
  );

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}
