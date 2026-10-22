"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";

import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { useAuthStore } from "@/store";
import { createA2UIMessageRenderer } from "./MyA2UIMessageRenderer";
import { theme } from "./theme";
import { answerCopyRenderer } from "@/features/chat/shared/AnswerCopyButton";

const customMessageRenderers = [answerCopyRenderer];

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { getOrSetVisitorId } from "@/lib/utils";

function CopilotKitContent({
  children,
  slug,
  accessToken,
  isGuest = false,
}: {
  children: React.ReactNode;
  slug: string;
  accessToken: string | null;
  isGuest: boolean;
}) {
  const locale = useLocale();
  const activityRenderers = useMemo(() => {
    return [createA2UIMessageRenderer({ theme })];
  }, []);
  const runtimeUrl = `/dingent-resource/api/v1/${slug}/chat`;
  const storedVisitorId = useAuthStore((state) => state.visitorId);
  useEffect(() => {
    if (isGuest && !storedVisitorId) {
      getOrSetVisitorId();
    }
  }, [isGuest, storedVisitorId]);
  const visitorId = isGuest ? storedVisitorId : null;

  const headers = useMemo(() => {
    if (isGuest) {
      // 游客模式
      return {
        "X-Visitor-ID": visitorId,
        WorkspaceSlug: slug,
      };
    } else {
      // 用户模式
      return {
        Authorization: `Bearer ${accessToken}`,
        WorkspaceSlug: slug,
      };
    }
  }, [isGuest, accessToken, slug, visitorId]);

  if (isGuest && !visitorId) return null;

  return (
    <CopilotKitProvider
      renderActivityMessages={activityRenderers}
      renderCustomMessages={customMessageRenderers}
      runtimeUrl={runtimeUrl}
      headers={headers}
      properties={{
        authorization: accessToken,
        workspace_slug: slug,
        is_guest: isGuest,
        response_locale: locale,
      }}
    >
      {children}
    </CopilotKitProvider>
  );
}

export function CopilotKitWrapper({
  children,
  isGuest = false,
}: {
  children: React.ReactNode;
  isGuest?: boolean;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const params = useParams();
  const slug = params.slug as string;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <CopilotKitContent slug={slug} accessToken={accessToken} isGuest={isGuest}>
      {children}
    </CopilotKitContent>
  );
}
