import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadProvider, useThreadContext } from "./ThreadProvider";

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "test-workspace" }),
}));

vi.mock("@/lib/api/client", () => {
  const serverThreads = ["latest-thread", "last-active-thread"].map((id) => ({
    id,
    title: id,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }));
  const api = { threads: { list: async () => serverThreads } };
  return { getClientApi: () => ({ forWorkspace: () => api }) };
});

const storageKey = "currentChatThreadId:test-workspace:authenticated";

function ActiveThread() {
  const { activeThreadId, isLoading, threads } = useThreadContext();
  if (isLoading) return null;
  return (
    <div data-testid="active-thread">
      {threads.find((thread) => thread.id === activeThreadId)?.title}
    </div>
  );
}

function openChat(search: string) {
  window.history.replaceState(null, "", `/chat${search}`);
  return render(
    <ThreadProvider>
      <ActiveThread />
    </ThreadProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(storageKey);
  window.history.replaceState(null, "", "/");
});

describe("chat thread restoration", () => {
  it.each([
    "",
    "?workflow=BIGsearch",
    "?database=biosample",
    "?workflow=bing_search&database=biosample",
    "?workflow=BIGsearch&database=biosample&query=%20%20",
  ])("restores the same conversation on reload with %s", async (search) => {
    window.localStorage.setItem(storageKey, "last-active-thread");
    const chat = openChat(search);
    expect(await screen.findByTestId("active-thread")).toHaveTextContent(
      "last-active-thread",
    );

    chat.unmount();
    openChat(search);
    expect(await screen.findByTestId("active-thread")).toHaveTextContent(
      "last-active-thread",
    );
  });

  it("starts a new conversation for a nonempty external question", async () => {
    window.localStorage.setItem(storageKey, "last-active-thread");
    openChat("?workflow=BIGsearch&database=biosample&query=Find+records");
    expect(await screen.findByTestId("active-thread")).toHaveTextContent(
      "New Chat",
    );
  });
});
