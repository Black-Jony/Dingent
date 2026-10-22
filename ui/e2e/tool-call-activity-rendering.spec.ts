import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createTranslator } from "next-intl";
import { locales, localeCookieName } from "../src/i18n/config";

const visitorId = "018f4d80-0000-7000-8000-000000000001";
const WORKSPACE_SLUG = "playwright-e2e";

/* ── SSE helpers ─────────────────────────────────────────── */

function sseEvent(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function activitySnapshotEvent(
  messageId: string,
  activityType: string,
  content: Record<string, unknown>,
) {
  return { type: "ACTIVITY_SNAPSHOT", messageId, activityType, content };
}

/** Real A2UI operations from the Python backend for table display. */
const REAL_A2UI_COMPONENTS = [
  {
    id: "root",
    component: "Column",
    children: ["tableTitle", "tableHeader", "row_0", "row_1", "paginationRow"],
    align: "stretch",
  },
  { id: "tableTitle", component: "Text", text: "Scores", variant: "h3" },
  {
    id: "tableHeader",
    component: "Row",
    children: ["header_0", "header_1"],
    justify: "spaceBetween",
    align: "center",
  },
  { id: "header_0", component: "Text", text: "name", variant: "caption" },
  { id: "header_1", component: "Text", text: "score", variant: "caption" },
  {
    id: "row_0",
    component: "Row",
    children: ["row_0_cell_0", "row_0_cell_1"],
    justify: "spaceBetween",
    align: "center",
  },
  { id: "row_0_cell_0", component: "Text", text: "Alice" },
  { id: "row_0_cell_1", component: "Text", text: "95" },
  {
    id: "row_1",
    component: "Row",
    children: ["row_1_cell_0", "row_1_cell_1"],
    justify: "spaceBetween",
    align: "center",
  },
  { id: "row_1_cell_0", component: "Text", text: "Bob" },
  { id: "row_1_cell_1", component: "Text", text: "87" },
  {
    id: "paginationRow",
    component: "Row",
    children: ["prevBtn", "pageInfo", "nextBtn"],
    justify: "center",
    align: "center",
  },
  {
    id: "prevBtn",
    component: "Button",
    child: "prevBtnText",
    action: {
      event: { name: "test_tool", context: { query_args: { page: 1 } } },
    },
  },
  { id: "prevBtnText", component: "Text", text: "Previous" },
  { id: "pageInfo", component: "Text", text: "Page 1", variant: "caption" },
  {
    id: "nextBtn",
    component: "Button",
    child: "nextBtnText",
    action: {
      event: { name: "test_tool", context: { query_args: { page: 2 } } },
    },
  },
  { id: "nextBtnText", component: "Text", text: "Next" },
];

const REAL_A2UI_OPS = [
  {
    version: "v0.9",
    createSurface: {
      surfaceId: "test-surface",
      catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
    },
  },
  {
    version: "v0.9",
    updateComponents: {
      surfaceId: "test-surface",
      components: REAL_A2UI_COMPONENTS,
    },
  },
  {
    version: "v0.9",
    updateDataModel: {
      surfaceId: "test-surface",
      path: "/",
      value: {
        title: "Scores",
        columns: ["name", "score"],
        rows: [
          { name: "Alice", score: 95 },
          { name: "Bob", score: 87 },
        ],
        pageInfo: "Page 1",
        isFirstPage: true,
        isLastPage: false,
      },
    },
  },
];

/* ── Stream builders ─────────────────────────────────────────── */

function buildMarkdownStream(): string {
  return [
    { type: "RUN_STARTED", threadId: "t-md", runId: "r-md" },
    { type: "TEXT_MESSAGE_START", messageId: "msg-md", role: "assistant" },
    {
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "msg-md",
      delta: "Let me summarize…\n\n",
    },
    activitySnapshotEvent("call_md:activity", "a2ui-surface", {
      type: "markdown",
      title: "Analysis Result",
      content: "**Alice** scored 95 points.\n\n**Bob** scored 87 points.",
    }),
    {
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "msg-md",
      delta: "That's the summary.",
    },
    { type: "TEXT_MESSAGE_END", messageId: "msg-md" },
    { type: "RUN_FINISHED", threadId: "t-md", runId: "r-md" },
  ]
    .map(sseEvent)
    .join("");
}

function buildA2UIStream(): string {
  return [
    { type: "RUN_STARTED", threadId: "t-a2ui", runId: "r-a2ui" },
    { type: "TEXT_MESSAGE_START", messageId: "msg-a2ui", role: "assistant" },
    {
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "msg-a2ui",
      delta: "Here is the data:\n\n",
    },
    activitySnapshotEvent("call_table:activity", "a2ui-surface", {
      a2ui_operations: REAL_A2UI_OPS,
      surfaceId: "test-surface",
    }),
    { type: "TEXT_MESSAGE_CONTENT", messageId: "msg-a2ui", delta: "Done." },
    { type: "TEXT_MESSAGE_END", messageId: "msg-a2ui" },
    { type: "RUN_FINISHED", threadId: "t-a2ui", runId: "r-a2ui" },
  ]
    .map(sseEvent)
    .join("");
}

function buildMultiItemStream(): string {
  return [
    { type: "RUN_STARTED", threadId: "t-multi", runId: "r-multi" },
    { type: "TEXT_MESSAGE_START", messageId: "msg-multi", role: "assistant" },
    {
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "msg-multi",
      delta: "Results:\n\n",
    },
    activitySnapshotEvent("call_multi:activity:0", "a2ui-surface", {
      type: "markdown",
      title: "Quick Summary",
      content: "Found **2 records**.",
    }),
    activitySnapshotEvent("call_multi:activity:1", "a2ui-surface", {
      a2ui_operations: REAL_A2UI_OPS,
      surfaceId: "test-surface",
    }),
    {
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "msg-multi",
      delta: " All done.",
    },
    { type: "TEXT_MESSAGE_END", messageId: "msg-multi" },
    { type: "RUN_FINISHED", threadId: "t-multi", runId: "r-multi" },
  ]
    .map(sseEvent)
    .join("");
}

function buildPlainStream(): string {
  return [
    { type: "RUN_STARTED", threadId: "t-plain", runId: "r-plain" },
    { type: "TEXT_MESSAGE_START", messageId: "msg-plain", role: "assistant" },
    {
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "msg-plain",
      delta: "Plain response, no tools.",
    },
    { type: "TEXT_MESSAGE_END", messageId: "msg-plain" },
    { type: "RUN_FINISHED", threadId: "t-plain", runId: "r-plain" },
  ]
    .map(sseEvent)
    .join("");
}

/* ── Shared route setup helper ──────────────────────────────── */

/**
 * Intercept CopilotKit POST requests to /chat/agent/{id}/connect and /chat/agent/{id}/run.
 * Returns a fake SSE stream. The `run` call is the one that streams agent events.
 */
async function interceptAgentRoute(page: any, streamBody: string) {
  // CopilotKit sends two POSTs: /connect (initial state) and /run (streaming)
  await page.route(/\/chat\/agent\/.*\/(connect|run)$/, async (route: any) => {
    if (route.request().method() !== "POST") return route.continue();

    const url = route.request().url();
    if (url.endsWith("/connect")) {
      // /connect response: just a basic state snapshot
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: "",
      });
      return;
    }

    if (url.endsWith("/run")) {
      // /run response: our fake agent streaming events
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: streamBody,
      });
      return;
    }

    return route.continue();
  });
}

async function seedGuestThread(page: any) {
  await page.addInitScript(
    ({ id, workspaceSlug }) => {
      window.localStorage.setItem("dingent_visitor_id", id);
      window.localStorage.setItem(
        `currentChatThreadId:${workspaceSlug}:${id}`,
        "",
      );
    },
    { id: visitorId, workspaceSlug: WORKSPACE_SLUG },
  );
}

/* ── Tests ──────────────────────────────────────────────────── */

test.describe("Tool call activity rendering E2E", () => {
  test("settles paced execution across completion, stop, and consecutive questions", async ({
    page,
  }) => {
    await seedGuestThread(page);
    await interceptAgentRoute(page, "");
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      let runNumber = 0;
      window.fetch = async (request, init) => {
        const url = request instanceof Request ? request.url : String(request);
        if (!/\/chat\/agent\/.*\/run$/.test(url))
          return originalFetch(request, init);
        const input = JSON.parse(String(init?.body));
        const currentRun = ++runNumber;
        const callId = `paced-call-${input.runId}`;
        const answerId = `paced-answer-${input.runId}`;
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let closed = false;
            const signal =
              init?.signal ??
              (request instanceof Request ? request.signal : undefined);
            signal?.addEventListener(
              "abort",
              () => {
                if (closed) return;
                closed = true;
                controller.error(
                  new DOMException("Request stopped", "AbortError"),
                );
              },
              { once: true },
            );
            const send = (event: Record<string, unknown>) =>
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
              );
            send({
              type: "RUN_STARTED",
              threadId: input.threadId,
              runId: input.runId,
            });
            send({
              type: "TOOL_CALL_START",
              toolCallId: callId,
              toolCallName: "direct_index_status",
              parentMessageId: `paced-tool-${input.runId}`,
            });
            send({
              type: "TOOL_CALL_ARGS",
              toolCallId: callId,
              delta: "{}",
            });
            send({ type: "TOOL_CALL_END", toolCallId: callId });
            send({
              type: "TOOL_CALL_RESULT",
              toolCallId: callId,
              messageId: `paced-result-${input.runId}`,
              role: "tool",
              content: "Done",
            });
            send({
              type: "TEXT_MESSAGE_START",
              messageId: answerId,
              role: "assistant",
            });
            send({
              type: "TEXT_MESSAGE_CONTENT",
              messageId: answerId,
              delta: `Streaming answer ${currentRun}.`,
            });
            const controls = window as typeof window & {
              advanceExecutionTest?: (finish: boolean) => void;
            };
            controls.advanceExecutionTest = (finish) => {
              if (closed) return;
              if (!finish) {
                send({
                  type: "TEXT_MESSAGE_CONTENT",
                  messageId: answerId,
                  delta: "\n\nFinal answer completed.",
                });
                return;
              }
              send({ type: "TEXT_MESSAGE_END", messageId: answerId });
              send({
                type: "RUN_FINISHED",
                threadId: input.threadId,
                runId: input.runId,
              });
              closed = true;
              controller.close();
            };
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream" },
        });
      };
    });
    await page.goto(`/dingent-resource/guest/${WORKSPACE_SLUG}/chat`);
    const input = page.getByRole("textbox").last();
    await expect(input).toBeVisible();
    await input.fill("Verify paced execution state");
    await input.press("Enter");
    await expect(
      page.getByText("Streaming answer 1.", { exact: true }),
    ).toBeVisible();
    const trace = page.locator("[data-execution-trace]");
    const toggle = trace.getByRole("button");
    await expect(toggle).toContainText("Working...");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.evaluate(() => {
      (
        window as typeof window & {
          advanceExecutionTest: (finish: boolean) => void;
        }
      ).advanceExecutionTest(false);
    });
    await expect(
      page.getByText("Final answer completed.", { exact: true }),
    ).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.evaluate(() => {
      (
        window as typeof window & {
          advanceExecutionTest: (finish: boolean) => void;
        }
      ).advanceExecutionTest(true);
    });
    await expect(toggle).toContainText("Execution complete");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(trace.locator(".animate-spin")).toHaveCount(0);
    await expect(page.locator(".animate-spin")).toHaveCount(0);

    await input.fill("Stop the next answer");
    await input.press("Enter");
    await expect(
      page.getByText("Streaming answer 2.", { exact: true }),
    ).toBeVisible();
    await expect(toggle).toContainText("Working...");
    await page.getByTestId("copilot-send-button").click();
    await expect(page.locator(".animate-spin")).toHaveCount(0);
    await expect(toggle).not.toContainText("Working...");

    await input.fill("Ask again after stopping");
    await input.press("Enter");
    await expect(
      page.getByText("Streaming answer 3.", { exact: true }),
    ).toBeVisible();
    await expect(toggle).toContainText("Working...");
    await page.evaluate(() => {
      (
        window as typeof window & {
          advanceExecutionTest: (finish: boolean) => void;
        }
      ).advanceExecutionTest(true);
    });
    await expect(toggle).toContainText("Execution complete");
    await expect(page.locator(".animate-spin")).toHaveCount(0);
  });

  test("renders compact grouped execution traces across seven languages and screen sizes", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(90_000);
    await seedGuestThread(page);
    const events: Array<Record<string, unknown>> = [
      { type: "RUN_STARTED", threadId: "trace-thread", runId: "trace-run" },
    ];
    for (const [index, name] of [
      "query_database_record",
      "write_todos",
      "query_database_record",
    ].entries()) {
      const id = `trace-call-${index}`;
      events.push(
        {
          type: "TOOL_CALL_START",
          toolCallId: id,
          toolCallName: name,
          parentMessageId: `trace-message-${index}`,
        },
        {
          type: "TOOL_CALL_ARGS",
          toolCallId: id,
          delta: JSON.stringify(
            name === "write_todos" ? { todos: [] } : { query: "demo" },
          ),
        },
        { type: "TOOL_CALL_END", toolCallId: id },
        {
          type: "TOOL_CALL_RESULT",
          toolCallId: id,
          messageId: `trace-result-${index}`,
          role: "tool",
          content: "Done",
        },
      );
    }
    events.push(
      {
        type: "TEXT_MESSAGE_START",
        messageId: "trace-answer",
        role: "assistant",
      },
      {
        type: "TEXT_MESSAGE_CONTENT",
        messageId: "trace-answer",
        delta: "Execution display verified.",
      },
      { type: "TEXT_MESSAGE_END", messageId: "trace-answer" },
      { type: "RUN_FINISHED", threadId: "trace-thread", runId: "trace-run" },
    );
    await interceptAgentRoute(page, events.map(sseEvent).join(""));
    for (const locale of locales) {
      await page.context().addCookies([
        {
          name: localeCookieName,
          value: locale,
          url: new URL(baseURL!).origin,
        },
      ]);
      const t = createTranslator({
        locale,
        messages: JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")),
        namespace: "Chat.thinking",
      });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`/dingent-resource/guest/${WORKSPACE_SLUG}/chat`);
        const input = page.getByRole("textbox").last();
        await expect(input).toBeVisible();
        await input.fill("Verify compact execution display");
        await input.press("Enter");
        await expect(
          page.getByText("Execution display verified."),
        ).toBeVisible();
        const trace = page.locator("[data-execution-trace]");
        const toggle = trace.getByRole("button");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(
          trace.getByText(t("completed"), { exact: true }),
        ).toBeVisible();
        await expect(
          trace.getByText(t("stepCount", { count: 1 }), { exact: true }),
        ).toBeVisible();
        await toggle.click();
        await expect(
          trace.locator("ol").first().locator(":scope > li"),
        ).toHaveCount(1);
        const details = trace.locator("summary");
        await expect(details).toHaveText(t("callDetails", { count: 2 }));
        await details.click();
        await expect(trace.locator("details")).toHaveAttribute("open", "");
        await expect(trace).not.toContainText("write todos");
        await expect(trace).not.toContainText("Step 1");
        await expect(trace.locator(".animate-spin")).toHaveCount(0);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow).toBe(false);
        if (
          (locale === "zh-CN" && width === 1440) ||
          (locale === "ar" && width === 390)
        ) {
          if (locale === "ar")
            await page.evaluate(() =>
              document.documentElement.classList.add("dark"),
            );
          await page.screenshot({
            path: testInfo.outputPath(`${locale}-${width}.png`),
            fullPage: true,
          });
        }
      }
    }
  });

  test("hides plan cards and acknowledgments during a new answer and after reloading history", async ({
    page,
  }) => {
    await seedGuestThread(page);
    const snapshot: Array<Record<string, unknown>> = [];
    const events: Array<Record<string, unknown>> = [];
    let threadId = "";
    const question = "Run a plan update regression";
    for (let index = 0; index < 4; index++) {
      const callId = `plan-call-${index}`;
      const messageId = `plan-message-${index}`;
      const todos = [
        { content: `Plan revision ${index + 1}`, status: "in_progress" },
      ];
      const args = JSON.stringify({ todos });
      const result = `Updated todo list to ${JSON.stringify(todos)}`;
      snapshot.push({
        id: messageId,
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: callId,
            type: "function",
            function: { name: "write_todos", arguments: args },
          },
        ],
      });
      snapshot.push({
        id: `plan-result-${index}`,
        role: "tool",
        toolCallId: callId,
        content: result,
      });
      events.push(
        {
          type: "TOOL_CALL_START",
          toolCallId: callId,
          toolCallName: "write_todos",
          parentMessageId: messageId,
        },
        { type: "TOOL_CALL_ARGS", toolCallId: callId, delta: args },
        { type: "TOOL_CALL_END", toolCallId: callId },
        {
          type: "TOOL_CALL_RESULT",
          messageId: `plan-result-${index}`,
          toolCallId: callId,
          role: "tool",
          content: result,
        },
      );
    }
    snapshot.push({
      id: "plan-answer",
      role: "assistant",
      content: "Plan regression finished.",
    });
    await page.route(/\/chat\/agent\/.*\/(connect|run)$/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const input = route.request().postDataJSON();
      threadId = input.threadId;
      const run = route.request().url().endsWith("/run");
      const body = run
        ? [
            { type: "RUN_STARTED", threadId, runId: "plan-run" },
            ...events,
            {
              type: "TEXT_MESSAGE_START",
              messageId: "plan-answer",
              role: "assistant",
            },
            {
              type: "TEXT_MESSAGE_CONTENT",
              messageId: "plan-answer",
              delta: "Plan regression finished.",
            },
            { type: "TEXT_MESSAGE_END", messageId: "plan-answer" },
            { type: "RUN_FINISHED", threadId, runId: "plan-run" },
          ]
        : [
            { type: "RUN_STARTED", threadId, runId: input.runId },
            {
              type: "MESSAGES_SNAPSHOT",
              messages: snapshot.some((message) => message.role === "user")
                ? snapshot
                : [],
            },
            { type: "RUN_FINISHED", threadId, runId: input.runId },
          ];
      if (run && !snapshot.some((message) => message.role === "user"))
        snapshot.unshift({
          id: "plan-question",
          role: "user",
          content: question,
        });
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: body.map(sseEvent).join(""),
      });
    });
    await page.goto(`/dingent-resource/guest/${WORKSPACE_SLUG}/chat`);
    const input = page.getByRole("textbox").last();
    await expect(input).toBeVisible();
    await input.fill(question);
    await input.press("Enter");
    await expect(page.getByText("Plan regression finished.")).toBeVisible();
    await expect(page.getByText("Execution Plan", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText("Plan updated.", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText(/^Plan revision [1-4]$/)).toHaveCount(0);
    await expect(page.locator(".animate-spin")).toHaveCount(0);
    await page.route(
      /\/api\/v1\/playwright-e2e\/chat\/threads$/,
      async (route) => {
        await route.fulfill({
          json: [
            {
              id: threadId,
              title: question,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        });
      },
    );
    await page.reload();
    await expect(page.getByText("Plan regression finished.")).toBeVisible();
    await expect(page.getByText("Execution Plan", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText("Plan updated.", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText(/^Plan revision [1-4]$/)).toHaveCount(0);
    await expect(page.locator(".animate-spin")).toHaveCount(0);
  });

  test("renders markdown activity message in the middle section", async ({
    page,
  }) => {
    await seedGuestThread(page);

    await interceptAgentRoute(page, buildMarkdownStream());

    await page.goto(`/dingent-resource/guest/${WORKSPACE_SLUG}/chat`);
    await expect(page.getByText("New Chat").first()).toBeVisible({
      timeout: 10_000,
    });

    const input = page.getByRole("textbox").last();
    await input.fill("Show analysis");
    await input.press("Enter");

    // Wait for the assistant text to appear (proof SSE was processed)
    await expect(page.getByText("That's the summary.")).toBeVisible({
      timeout: 15_000,
    });

    // Verify markdown activity rendered in the middle section
    await expect(page.getByText("Analysis Result")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/Alice/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/scored 95 points/)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/Bob/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/scored 87 points/)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("renders A2UI table activity message in the middle section", async ({
    page,
  }) => {
    await seedGuestThread(page);

    await interceptAgentRoute(page, buildA2UIStream());

    await page.goto(`/dingent-resource/guest/${WORKSPACE_SLUG}/chat`);
    await expect(page.getByText("New Chat").first()).toBeVisible({
      timeout: 10_000,
    });

    const input = page.getByRole("textbox").last();
    await input.fill("Show table");
    await input.press("Enter");

    await expect(page.getByText("Done.")).toBeVisible({ timeout: 15_000 });

    // Verify A2UI table rendered: title, data cells, pagination
    await expect(page.getByText("Scores")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Alice")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("95")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Bob")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("87")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Page 1")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Previous")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Next")).toBeVisible({ timeout: 5_000 });
  });

  test("renders both markdown and A2UI table when tool returns multi-item display", async ({
    page,
  }) => {
    await seedGuestThread(page);

    await interceptAgentRoute(page, buildMultiItemStream());

    await page.goto(`/dingent-resource/guest/${WORKSPACE_SLUG}/chat`);
    await expect(page.getByText("New Chat").first()).toBeVisible({
      timeout: 10_000,
    });

    const input = page.getByRole("textbox").last();
    await input.fill("Show everything");
    await input.press("Enter");

    await expect(page.getByText("All done.")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Quick Summary")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/2 records/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Scores")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Alice")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Bob")).toBeVisible({ timeout: 5_000 });
  });

  test("no activity messages shown when SSE stream has no activity events", async ({
    page,
  }) => {
    await seedGuestThread(page);

    await interceptAgentRoute(page, buildPlainStream());

    await page.goto(`/dingent-resource/guest/${WORKSPACE_SLUG}/chat`);
    await expect(page.getByText("New Chat").first()).toBeVisible({
      timeout: 10_000,
    });

    const input = page.getByRole("textbox").last();
    await input.fill("Hello");
    await input.press("Enter");

    await expect(page.getByText("Plain response, no tools.")).toBeVisible({
      timeout: 15_000,
    });

    // No activity-related content should appear
    await expect(page.getByText("Scores")).not.toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("Analysis Result")).not.toBeVisible({
      timeout: 3_000,
    });
  });
});
