import { expect, test } from "@playwright/test";

const visitorId = "018f4d80-0000-7000-8000-000000000001";
const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 8765);

test("guest chat completes a real browser/backend flow and can switch conversations", async ({
  page,
  request,
}) => {
  await page.addInitScript((id) => {
    window.localStorage.setItem("dingent_visitor_id", id);
    window.localStorage.setItem(`currentChatThreadId:playwright-e2e:${id}`, "");
  }, visitorId);

  await page.goto(
    "/dingent-resource/guest/playwright-e2e/chat?workflow=playwright-e2e-flow",
  );

  await expect(page.getByText("New Chat").first()).toBeVisible();
  await page.waitForURL(/\/guest\/playwright-e2e\/chat$/);

  const input = page.getByRole("textbox").last();
  const mainContent = page.locator("#main-content");
  await expect(mainContent).toBeVisible();
  await page.waitForTimeout(400);
  const widthBeforeUploadMenu = (await mainContent.boundingBox())?.width;

  await page.getByTestId("copilot-add-menu-button").click();
  await expect(page.locator("body[data-scroll-locked]")).toBeVisible();
  const widthWithUploadMenu = (await mainContent.boundingBox())?.width;

  expect(widthBeforeUploadMenu).toBeDefined();
  expect(widthWithUploadMenu).toBeDefined();
  expect(Math.abs(widthWithUploadMenu! - widthBeforeUploadMenu!)).toBeLessThan(
    50,
  );
  await page.keyboard.press("Escape");

  await input.fill("Get data and analyze it from the browser");
  const sendButton = page.getByTestId("copilot-send-button");
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(
    page.getByText(
      "Reviewer final answer: browser e2e completed with mocked LLM output.",
    ),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .getByTestId("copilot-user-message")
      .getByText("Get data and analyze it from the browser"),
  ).toBeVisible();

  const state = await request.get(
    `http://127.0.0.1:${backendPort}/api/v1/__e2e__/state`,
  );
  await expect(state).toBeOK();
  const payload = await state.json();
  expect(payload.boundToolNames).toEqual([
    ["write_todos", "transfer_to_Analyst"],
    ["write_todos", "transfer_to_Reviewer"],
    ["write_todos"],
  ]);
  expect(payload.receivedMessages).toHaveLength(3);
  expect(JSON.stringify(payload.receivedMessages[0])).toContain(
    "Get data and analyze it from the browser",
  );

  let releaseHistory!: () => void;
  const historyGate = new Promise<void>((resolve) => {
    releaseHistory = resolve;
  });
  const connectRoute = /\/chat\/agent\/.*\/connect$/;
  await page.route(connectRoute, async (route) => {
    await historyGate;
    await route.continue();
  });
  try {
    await page.reload();
    await expect(page.getByTestId("chat-history-loading")).toBeVisible();
    const sendWhileLoading = page.getByTestId("copilot-send-button");
    await input.fill("Draft while loading");
    await expect(input).toHaveValue("Draft while loading");
    await expect(sendWhileLoading).toBeDisabled();
    await expect(sendWhileLoading.locator("svg.lucide-square")).toHaveCount(0);
    await expect(page.getByText("How can I help you today?")).not.toBeVisible();
    await page.screenshot({ path: test.info().outputPath("history-loading.png") });
  } finally {
    releaseHistory();
  }
  await expect(page.getByTestId("chat-history-loading")).toHaveCount(0);
  await expect(
    page.getByText(
      "Reviewer final answer: browser e2e completed with mocked LLM output.",
    ),
  ).toBeVisible();
  await expect(input).toHaveValue("Draft while loading");
  await expect(sendButton).toBeEnabled();
  const restoredState = await (
    await request.get(`http://127.0.0.1:${backendPort}/api/v1/__e2e__/state`)
  ).json();
  expect(restoredState.receivedMessages).toHaveLength(3);
  expect(restoredState.boundToolNames).toHaveLength(3);
  await page.screenshot({ path: test.info().outputPath("history-restored.png") });
  await page.unroute(connectRoute);
  await input.fill("");

  await page.getByText("New Chat").first().click();
  await expect(
    page.getByText(
      "Reviewer final answer: browser e2e completed with mocked LLM output.",
    ),
  ).not.toBeVisible();

  await input.fill("Start a second browser conversation");
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await expect(
    page
      .getByTestId("copilot-user-message")
      .getByText("Start a second browser conversation"),
  ).toBeVisible();

  await page
    .getByText("Get data and analyze it from the browser")
    .first()
    .click();
  await expect(
    page.getByText(
      "Reviewer final answer: browser e2e completed with mocked LLM output.",
    ),
  ).toBeVisible({ timeout: 30_000 });
});
