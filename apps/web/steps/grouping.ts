import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { When, Then } = createBdd();

const store: Record<string, number> = {};

function groupHeaders(page: import("@playwright/test").Page) {
  return page.locator("[data-testid='group-header']");
}

Then("at least one group header with a match-count badge exists", async ({ page }) => {
  await expect(groupHeaders(page).first()).toBeVisible();
  const badge = groupHeaders(page)
    .first()
    .locator("[data-testid='group-count']");
  await expect(badge).toHaveText(/\d+ matches?/);
  const count = parseInt((await badge.textContent()) ?? "0", 10);
  expect(count).toBeGreaterThanOrEqual(1);
});

When("I collapse the expanded group headers", async ({ page }) => {
  store.beforeCollapse = await page.locator(".results tbody tr").count();
  const expanded = groupHeaders(page).filter({ hasText: "▾" });
  const total = await expanded.count();
  for (let i = 0; i < total; i++) {
    // Re-locate each time: the DOM re-renders after every collapse.
    await groupHeaders(page).filter({ hasText: "▾" }).first().click();
  }
});

Then("fewer rows are rendered than before", async ({ page }) => {
  await expect
    .poll(async () => page.locator(".results tbody tr").count(), { timeout: 5_000 })
    .toBeLessThan(store.beforeCollapse);
});
