import { expect, test } from "@playwright/test";
import { localeCookieName } from "../src/i18n/config";

const visitorId = "018f4d80-0000-7000-8000-000000000001";
const recordRows = Array.from({ length: 21 }, (_, index) => ({
  id: index + 1,
  gene: `GENE-${index + 1}`,
  count: 0,
  active: false,
  detail: { genome: "hg38", note: "Synthetic display fixture" },
}));

function tableContent() {
  const columns = ["accession", "definition", "title", "dataType", "url"];
  return [
    {
      surfaceId: "second-fixture",
      a2ui_operations: [
        {
          createSurface: {
            surfaceId: "twas-fixture",
            catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
          },
        },
        {
          updateComponents: {
            surfaceId: "twas-fixture",
            components: [
              {
                id: "root",
                component: "Column",
                children: [
                  "tableTitle",
                  "tableHeader",
                  "row_0",
                  "paginationRow",
                ],
              },
              {
                id: "tableTitle",
                component: "Text",
                text: "TWAS display fixture",
                variant: "h3",
              },
              {
                id: "tableHeader",
                component: "Row",
                children: columns.map((_, index) => `header_${index}`),
              },
              ...columns.map((name, index) => ({
                id: `header_${index}`,
                component: "Text",
                text: name,
              })),
              {
                id: "row_0",
                component: "Row",
                children: columns.map((_, index) => `row_0_cell_${index}`),
              },
              ...columns.map((name, index) => ({
                id: `row_0_cell_${index}`,
                component: "Text",
                text: name,
              })),
              {
                id: "paginationRow",
                component: "Row",
                children: ["prevBtn", "pageInfo", "nextBtn"],
              },
              {
                id: "prevBtn",
                component: "Button",
                child: "prevText",
                action: { event: { name: "fixture", context: { page: 1 } } },
              },
              { id: "prevText", component: "Text", text: "Previous" },
              { id: "pageInfo", component: "Text", text: "Page 1" },
              {
                id: "nextBtn",
                component: "Button",
                child: "nextText",
                action: { event: { name: "fixture", context: { page: 2 } } },
              },
              { id: "nextText", component: "Text", text: "Next" },
            ],
          },
        },
        {
          updateDataModel: {
            surfaceId: "twas-fixture",
            path: "/",
            value: {
              title: "TWAS display fixture",
              columns,
              rows: [
                {
                  accession: "TWAS-DEMO-001",
                  title: "TP53",
                  definition: "Synthetic association",
                  url: "https://example.org/twas/1",
                  dataType: "Association",
                },
              ],
              pageInfo: "Page 1",
              isFirstPage: true,
              isLastPage: true,
            },
          },
        },
        {
          createSurface: {
            surfaceId: "second-fixture",
            catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
          },
        },
        {
          updateComponents: {
            surfaceId: "second-fixture",
            components: [
              {
                id: "root",
                component: "Column",
                children: [
                  "tableTitle",
                  "tableHeader",
                  "row_0",
                  "paginationRow",
                ],
              },
              {
                id: "tableTitle",
                component: "Text",
                text: "Second table fixture",
                variant: "h3",
              },
              {
                id: "tableHeader",
                component: "Row",
                children: ["header_0", "header_1"],
              },
              { id: "header_0", component: "Text", text: "metric" },
              { id: "header_1", component: "Text", text: "value" },
              {
                id: "row_0",
                component: "Row",
                children: ["row_0_cell_0", "row_0_cell_1"],
              },
              { id: "row_0_cell_0", component: "Text", text: "SECOND-SURFACE" },
              { id: "row_0_cell_1", component: "Text", text: "2" },
              { id: "paginationRow", component: "Row", children: [] },
            ],
          },
        },
        {
          updateDataModel: {
            surfaceId: "second-fixture",
            path: "/",
            value: {
              title: "Second table fixture",
              columns: ["metric", "value"],
              rows: [{ metric: "SECOND-SURFACE", value: 2 }],
            },
          },
        },
      ],
    },
    {
      type: "table",
      title: "Record list fixture",
      columns: ["Property", "Value"],
      rows: [
        ["count", 21],
        ["records", JSON.stringify(recordRows)],
        [
          "source",
          { href: "https://example.org/source", text: "Fixture source" },
        ],
      ],
    },
  ];
}

test("renders aligned records, preserves sort/page state on expansion, and restores tables from history on desktop and mobile", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(
    (id) => localStorage.setItem("dingent_visitor_id", id),
    visitorId,
  );
  let history: Record<string, unknown>[] = [];
  let threadId = "";
  await page.route(
    /\/api\/v1\/playwright-e2e\/chat\/threads$/,
    async (route) => {
      await route.fulfill({
        json: history.length
          ? [
              {
                id: threadId,
                title: "Check table display",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ]
          : [],
      });
    },
  );
  await page.route(/\/chat\/agent\/.*\/(connect|run)$/, async (route) => {
    const input = route.request().postDataJSON();
    threadId = input.threadId;
    if (route.request().url().endsWith("/run")) {
      history = [
        ...input.messages,
        ...tableContent().map((content, index) => ({
          id: `table-activity-${index}`,
          role: "activity",
          activityType: "a2ui-surface",
          content,
        })),
        {
          id: "table-answer",
          role: "assistant",
          content: "Display regression fixture complete.",
        },
      ];
    }
    await route.fulfill({
      contentType: "text/event-stream",
      body: [
        { type: "RUN_STARTED", threadId, runId: input.runId },
        { type: "MESSAGES_SNAPSHOT", messages: history },
        { type: "RUN_FINISHED", threadId, runId: input.runId },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(""),
    });
  });
  await page.goto("/dingent-resource/guest/playwright-e2e/chat");
  const input = page.getByRole("textbox").last();
  await expect(input).toBeVisible();
  await input.fill("Check table display");
  await input.press("Enter");
  await expect(
    page.getByText("Display regression fixture complete."),
  ).toBeVisible();

  const twas = page.locator("[data-result-table]").filter({
    has: page.getByRole("heading", { name: "TWAS display fixture" }),
  });
  await expect(twas.getByRole("cell").first()).toHaveText("TWAS-DEMO-001");
  await expect(
    page.getByRole("cell", { name: "SECOND-SURFACE", exact: true }),
  ).toBeVisible();
  const alignment = await twas.getByRole("table").evaluate((table) => {
    const headers = [...table.querySelectorAll("th")].map(
      (node) => node.getBoundingClientRect().left,
    );
    return [...table.querySelectorAll("tbody tr:first-child td")].every(
      (node, index) =>
        Math.abs(node.getBoundingClientRect().left - headers[index]) < 2,
    );
  });
  expect(alignment).toBe(true);
  await expect(twas.getByRole("button", { name: "Next" })).toBeDisabled();

  const list = page.locator("[data-result-table]").filter({
    has: page.getByRole("heading", { name: "Record list fixture" }),
  });
  await expect(list.getByRole("columnheader", { name: "Value" })).toHaveCount(
    0,
  );
  await expect(list.getByRole("columnheader")).toHaveCount(5);
  await expect(
    list.getByRole("link", { name: "Fixture source" }),
  ).toBeVisible();
  await list.getByRole("button", { name: "Next" }).click();
  await expect(
    list.getByRole("cell", { name: "GENE-21", exact: true }),
  ).toBeVisible();
  const artifact = list.locator(
    "xpath=ancestor::section[@data-analysis-artifact]",
  );
  await artifact
    .getByRole("button", { name: "Open in analysis workspace" })
    .click();
  const workspace = page.locator("[data-analysis-workspace]");
  await expect(
    workspace.getByRole("cell", { name: "GENE-21", exact: true }),
  ).toBeVisible();
  await workspace.getByRole("button", { name: "Previous" }).click();
  await workspace.getByRole("button", { name: "id", exact: true }).click();
  await workspace.getByRole("button", { name: "id", exact: true }).click();
  await expect(
    workspace.locator("tbody tr").first().getByRole("cell").first(),
  ).toHaveText("21");
  await page.screenshot({
    path: testInfo.outputPath("tables-desktop-expanded.png"),
  });
  await workspace
    .getByRole("button", { name: "Close analysis workspace" })
    .click();
  await expect(
    list.locator("tbody tr").first().getByRole("cell").first(),
  ).toHaveText("21");

  await page.reload();
  await expect(twas.getByRole("cell").first()).toHaveText("TWAS-DEMO-001");
  await expect(
    page.getByRole("cell", { name: "SECOND-SURFACE", exact: true }),
  ).toBeVisible();
  await expect(list.getByRole("table")).toBeVisible();
  await expect(page.locator(".animate-spin")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await list.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const scrollContainer = list.locator('[data-slot="table-container"]');
  expect(
    await scrollContainer.evaluate(
      (node) => node.scrollWidth > node.clientWidth,
    ),
  ).toBe(true);
  await scrollContainer.evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
  });
  await expect(
    list
      .getByRole("cell")
      .filter({ hasText: "Synthetic display fixture" })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("tables-mobile-scroll.png"),
  });
  await page
    .context()
    .addCookies([
      { name: localeCookieName, value: "ar", url: new URL(page.url()).origin },
    ]);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(twas.getByRole("cell").first()).toHaveText("TWAS-DEMO-001");
  await expect(
    page.getByRole("cell", { name: "SECOND-SURFACE", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await list.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("tables-arabic-dark.png"),
  });
});
