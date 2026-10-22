import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const controls = vi.hoisted(() => ({
  locale: "en",
  providerProperties: {} as Record<string, unknown>,
  auth: {
    accessToken: "test-token" as string | null,
    visitorId: "test-visitor",
  },
}));

vi.mock("next-intl", () => ({ useLocale: () => controls.locale }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "test-workspace" }),
}));
vi.mock("@/store", () => ({
  useAuthStore: (selector: (state: typeof controls.auth) => unknown) =>
    selector(controls.auth),
}));
vi.mock("@/components/MyA2UIMessageRenderer", () => ({
  createA2UIMessageRenderer: () => ({}),
}));
vi.mock("@copilotkit/react-core/v2", () => ({
  CopilotKitProvider: ({
    properties,
    children,
  }: {
    properties: Record<string, unknown>;
    children: ReactNode;
  }) => {
    controls.providerProperties = properties;
    return <>{children}</>;
  },
}));

vi.mock("@/features/chat/shared/AnswerCopyButton", () => ({
  answerCopyRenderer: {},
}));

import { CopilotKitWrapper } from "./CopilotKitWrapper";

afterEach(() => {
  cleanup();
  controls.locale = "en";
  controls.auth.accessToken = "test-token";
  controls.providerProperties = {};
});

describe("chat response language", () => {
  it.each(["en", "zh-CN", "fr", "ja", "ru", "ar", "es"])(
    "forwards %s for authenticated chats",
    (locale) => {
      controls.locale = locale;
      render(<CopilotKitWrapper>Chat</CopilotKitWrapper>);
      expect(controls.providerProperties.response_locale).toBe(locale);
      expect(controls.providerProperties.workspace_slug).toBe("test-workspace");
    },
  );

  it("updates the requested response language without remounting the conversation", () => {
    const view = render(<CopilotKitWrapper>Chat</CopilotKitWrapper>);
    expect(controls.providerProperties.response_locale).toBe("en");

    controls.locale = "ja";
    view.rerender(<CopilotKitWrapper>Chat</CopilotKitWrapper>);
    expect(controls.providerProperties.response_locale).toBe("ja");
  });

  it("forwards the same preference for guest chats", () => {
    controls.locale = "ar";
    controls.auth.accessToken = null;
    render(<CopilotKitWrapper isGuest>Chat</CopilotKitWrapper>);
    expect(controls.providerProperties.response_locale).toBe("ar");
    expect(controls.providerProperties.is_guest).toBe(true);
  });
});
