"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CopilotKitWrapper } from "@/components/CopilotKitWrapper";
import ChatProviders from "@/features/chat/shared/ChatProviders";
import { GuestChatSidebar } from "@/features/chat/shared/GuestChatSidebar";
import { getOrSetVisitorId } from "@/lib/utils";

export default function GuestLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const [visitorId, setVisitorId] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = getOrSetVisitorId();
    setVisitorId(id);
    setMounted(true);
  }, []);

  if (!mounted || !visitorId) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ChatProviders visitorId={visitorId} sidebar={<GuestChatSidebar />}>
      <CopilotKitWrapper isGuest={true}>{children}</CopilotKitWrapper>
    </ChatProviders>
  );
}
