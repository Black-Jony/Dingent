"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { BarChart3, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export interface AnalysisArtifact {
  id: string;
  title: string;
}

interface AnalysisWorkspaceValue {
  artifact: AnalysisArtifact | null;
  closeArtifact: () => void;
  openArtifact: (artifact: AnalysisArtifact) => void;
  portalTarget: HTMLDivElement | null;
  setPortalTarget: (target: HTMLDivElement | null) => void;
}

const AnalysisWorkspaceContext = createContext<AnalysisWorkspaceValue | null>(
  null,
);

export function AnalysisWorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [artifact, setArtifact] = useState<AnalysisArtifact | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);

  const openArtifact = useCallback((nextArtifact: AnalysisArtifact) => {
    setArtifact(nextArtifact);
  }, []);
  const closeArtifact = useCallback(() => setArtifact(null), []);

  const value = useMemo(
    () => ({
      artifact,
      closeArtifact,
      openArtifact,
      portalTarget,
      setPortalTarget,
    }),
    [artifact, closeArtifact, openArtifact, portalTarget],
  );

  return (
    <AnalysisWorkspaceContext.Provider value={value}>
      {children}
    </AnalysisWorkspaceContext.Provider>
  );
}

export function useAnalysisWorkspace() {
  const value = useContext(AnalysisWorkspaceContext);
  if (!value) {
    throw new Error(
      "useAnalysisWorkspace must be used inside AnalysisWorkspaceProvider",
    );
  }
  return value;
}

export function useAnalysisWorkspaceOptional() {
  return useContext(AnalysisWorkspaceContext);
}

export function AnalysisWorkspaceSlot() {
  const { artifact, closeArtifact, setPortalTarget } = useAnalysisWorkspace();
  const t = useTranslations("Chat.analysisWorkspace");

  if (!artifact) return null;

  return (
    <>
      <button
        type="button"
        aria-label={t("close")}
        className="fixed inset-0 z-[1240] bg-black/25 backdrop-blur-[2px] xl:hidden"
        onClick={closeArtifact}
      />
      <aside
        data-analysis-workspace
        className="fixed inset-y-0 right-0 z-[1250] flex w-full min-w-0 flex-col border-l bg-background shadow-2xl sm:w-[min(94vw,52rem)] xl:static xl:z-auto xl:h-full xl:w-full xl:shadow-none"
        aria-label={artifact.title}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex min-w-0 items-center gap-2.5">
            <BarChart3 className="size-4 shrink-0 text-muted-foreground" />
            <h2 className="truncate text-sm font-semibold">{artifact.title}</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-md"
            onClick={closeArtifact}
            aria-label={t("close")}
            title={t("close")}
          >
            <X className="size-4" />
          </Button>
        </header>
        <div
          ref={setPortalTarget}
          className="min-h-0 flex-1 overflow-auto px-4 py-4"
        />
      </aside>
    </>
  );
}

export function AnalysisWorkspacePanel({
  artifactId,
  children,
}: {
  artifactId: string;
  children: ReactNode;
}) {
  const { artifact, portalTarget } = useAnalysisWorkspace();

  if (!artifact || artifact.id !== artifactId || !portalTarget) return null;

  return createPortal(<div className="min-w-0">{children}</div>, portalTarget);
}
