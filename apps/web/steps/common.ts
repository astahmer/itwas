import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

/** Shared scratch state across steps of one scenario (tests run serially). */
const store: Record<string, unknown> = {};

export async function waitForResults(page: Page): Promise<number> {
  await expect
    .poll(async () => page.locator(".results tbody tr").count(), {
      timeout: 15_000,
      intervals: [200, 500],
    })
    .toBeGreaterThan(0);
  // Let the debounced search fully settle so counts are stable.
  const count = page.locator(".count");
  await expect
    .poll(async () => count.textContent(), { timeout: 10_000, intervals: [200, 500] })
    .toMatch(/match(es)?$/);
  return page.locator(".results tbody tr").count();
}

function queryInput(page: Page) {
  return page.locator("input[aria-label='query']");
}

Given("the app is loaded with no query", async ({ page }) => {
  await page.goto("/");
  await waitForResults(page);
});

Given(
  "the app is loaded in changes mode with query {string}",
  async ({ page }, query: string) => {
    await page.goto(`/?mode=changes&q=${encodeURIComponent(query)}`);
    await waitForResults(page);
  },
);

When("the match count settles", async ({ page }) => {
  store.beforeRows = await waitForResults(page);
});

When("I wait for results", async ({ page }) => {
  await waitForResults(page);
});

When("I type {string} into the query field", async ({ page }, text: string) => {
  await queryInput(page).fill(text);
});

Then("the visible result rows decrease compared to before", async ({ page }) => {
  const before = store.beforeRows as number;
  await expect.poll(async () => page.locator(".results tbody tr").count(), {
    timeout: 10_000,
  }).toBeLessThan(before);
});
