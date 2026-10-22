import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import ar from "../messages/ar.json";

const backend = `http://127.0.0.1:${process.env.E2E_BACKEND_PORT ?? 8765}/api/v1`;

async function authenticatedWorkspace(page: Page, request: APIRequestContext) {
  const email = `audit-${crypto.randomUUID()}@example.com`;
  const password = "Audit-password-123!";
  const registered = await request.post(`${backend}/auth/register`, {
    data: { username: "Audit User", email, password },
  });
  expect(registered.ok()).toBeTruthy();
  const response = await request.post(`${backend}/auth/token`, {
    form: { username: email, password },
  });
  expect(response.ok()).toBeTruthy();
  const { access_token: token } = await response.json();
  const workspaces = await request.get(`${backend}/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(workspaces.ok()).toBeTruthy();
  const [workspace] = await workspaces.json();
  await page
    .context()
    .addCookies([
      { name: "access_token", value: token, url: "http://127.0.0.1" },
    ]);
  return { workspace, token, email };
}

test("model saves preserve failed input; model search and settings navigation work", async ({
  page,
  request,
}) => {
  const { workspace, email } = await authenticatedWorkspace(page, request);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/dingent-resource/${workspace.slug}/models`);
  await page.getByRole("button", { name: "Add Model" }).click();
  const dialog = page.getByRole("dialog");
  const fields = dialog.getByRole("textbox");
  await fields.nth(0).fill("Searchable DeepSeek model");
  await fields.nth(1).fill("deepseek-chat");
  await fields.last().fill("[]");
  await dialog.getByRole("button", { name: /^Add$/ }).click();
  await expect(dialog.getByText(/invalid json/i)).toBeVisible();
  await fields.last().fill("{}");
  const modelRoute = `**/api/v1/${workspace.slug}/llms`;
  await page.route(modelRoute, async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        json: { detail: "Simulated save failure" },
      });
    else await route.continue();
  });
  await dialog.getByRole("button", { name: /^Add$/ }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Simulated save failure",
  );
  await expect(fields.nth(0)).toHaveValue("Searchable DeepSeek model");
  await page.unroute(modelRoute);
  await dialog.getByRole("button", { name: /^Add$/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Searchable DeepSeek model" }),
  ).toBeVisible();

  const profile = page.getByRole("button", { name: "Open profile menu" });
  await profile.click();
  await expect(page.getByRole("menu")).toContainText(email);
  await page.getByRole("menuitem", { name: /^Settings/ }).click();
  const settings = page.getByRole("dialog");
  await settings.getByRole("combobox").click();
  await page.getByPlaceholder("Search models...").fill("DeepSeek");
  await expect(
    page.getByRole("option", { name: /Searchable DeepSeek model/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("workflow metadata updates preserve its graph and failures keep the settings draft", async ({
  page,
  request,
}) => {
  const { workspace, token } = await authenticatedWorkspace(page, request);
  const headers = { Authorization: `Bearer ${token}` };
  const assistantResponse = await request.post(
    `${backend}/${workspace.slug}/assistants`,
    { headers, data: { name: "Graph assistant", description: "Audit" } },
  );
  expect(assistantResponse.ok()).toBeTruthy();
  const assistant = await assistantResponse.json();
  const created = await request.post(`${backend}/${workspace.slug}/workflows`, {
    headers,
    data: { name: "Original workflow" },
  });
  expect(created.ok()).toBeTruthy();
  const workflow = await created.json();
  const seeded = await request.put(
    `${backend}/${workspace.slug}/workflows/${workflow.id}`,
    {
      headers,
      data: {
        name: workflow.name,
        description: "Original description",
        nodes: [
          {
            id: "node-1",
            assistantId: assistant.id,
            position: { x: 0, y: 0 },
            isStartNode: true,
            type: "assistant",
          },
        ],
        edges: [],
      },
    },
  );
  expect(seeded.ok()).toBeTruthy();
  await page.goto(`/dingent-resource/${workspace.slug}/workflows`);
  await expect(
    page.getByText("Original workflow", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Workflow Settings", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Renamed workflow");
  await dialog.getByLabel("Description").fill("");
  const path = `**/api/v1/${workspace.slug}/workflows/${workflow.id}`;
  await page.route(path, async (route) => {
    if (route.request().method() === "PATCH")
      await route.fulfill({
        status: 503,
        json: { detail: "Simulated workflow failure" },
      });
    else await route.continue();
  });
  await dialog.getByRole("button", { name: "Save Changes" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Simulated workflow failure",
  );
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(
    "Renamed workflow",
  );
  await page.unroute(path);
  await dialog.getByRole("button", { name: "Save Changes" }).click();
  await expect(dialog).not.toBeVisible();
  const result = await request.get(
    `${backend}/${workspace.slug}/workflows/${workflow.id}`,
    { headers },
  );
  const updated = await result.json();
  expect(updated.name).toBe("Renamed workflow");
  expect(updated.description).toBe("");
  expect(updated.nodes).toHaveLength(1);
  await expect(
    page.getByText("Renamed workflow", { exact: true }),
  ).toBeVisible();
  await request.patch(`${backend}/${workspace.slug}/workflows/${workflow.id}`, {
    headers,
    data: { description: "Keep the graph description" },
  });
  await page.reload();
  await page.getByText("Renamed workflow", { exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.locator(".react-flow__node")).toBeVisible();
  expect(
    (await page.locator(".react-flow").boundingBox())!.height,
  ).toBeGreaterThan(300);
  await page.screenshot({
    path: `${test.info().outputDir}/workflow-canvas.png`,
  });
  const savedGraph = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().endsWith(`/workflows/${workflow.id}`),
  );
  await page
    .getByRole("button", { name: "Save Workflow", exact: true })
    .click();
  expect((await savedGraph).ok()).toBeTruthy();
  const graph = await request.get(
    `${backend}/${workspace.slug}/workflows/${workflow.id}`,
    { headers },
  );
  expect((await graph.json()).description).toBe("Keep the graph description");
});

test("mobile Arabic settings remain readable and workspace sign-out reaches the login page", async ({
  page,
  request,
}) => {
  const { workspace } = await authenticatedWorkspace(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .context()
    .addCookies([
      { name: "dingent-locale", value: "ar", url: "http://127.0.0.1" },
    ]);
  await page.goto(`/dingent-resource/${workspace.slug}/models`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const profile = page.locator('button:has([data-slot="avatar"])');
  await profile.click();
  await page
    .getByRole("menuitem", { name: ar.Profile.settings, exact: true })
    .click();
  const settings = page.getByRole("dialog");
  await expect(settings.getByRole("combobox").first()).toBeVisible();
  const widths = await settings.evaluate((element) => ({
    width: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.width + 2);
  const workspaceName = settings.locator("#workspace-name");
  const box = await workspaceName.boundingBox();
  expect(box!.width).toBeGreaterThan(250);
  await settings.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await page.screenshot({
    path: `${test.info().outputDir}/arabic-mobile-settings.png`,
  });
  await page.keyboard.press("Escape");

  await page
    .context()
    .addCookies([
      { name: "dingent-locale", value: "en", url: "http://127.0.0.1" },
    ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page
    .locator('[data-slot="sidebar-header"]')
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(/\/dingent-resource\/auth\/login$/);
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "access_token",
    ),
  ).toBe(false);
});
