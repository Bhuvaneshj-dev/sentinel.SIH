const { test, expect } = require("@playwright/test");
test("scenario, transaction, independent approval and audit", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Trust the voice. Verify the action." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start scenario" }).click();
  await expect(page.getByText("Session active", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Request sandbox transfer" }).click();
  await page.getByRole("button", { name: "Create approval request" }).click();
  await expect(
    page.getByText("Transaction held. Independent approval is required."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review approval" }).click();
  await page.getByRole("button", { name: "Approve exact details" }).click();
  await page.getByRole("button", { name: "Execute sandbox transfer" }).click();
  await expect(
    page.getByText("Sandbox transaction completed. No money moved."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Audit trail", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "transfer.executed_sandbox" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeEnabled();
  expect(errors).toEqual([]);
});
test("missing backend is reported and does not fake a connection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Live gateway", exact: true }).click();
  await page
    .getByRole("button", { name: "Connect gateway", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Connect your gateway" }),
  ).toBeVisible();
});
test("mobile is usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start scenario" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Start scenario" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await expect(
    page.getByRole("button", { name: "Start scenario" }),
  ).toBeVisible();
});
