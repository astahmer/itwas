import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

const store: Record<string, string | undefined> = {};

function firstChangeId(page: Page) {
  return page.locator(".results tbody tr").first().locator(".change-id");
}

function sortedDateHeader(page: Page) {
  return page.locator("th[aria-sort]:not([aria-sort='none'])");
}

Given(
  "the app is loaded with sort state cleared and the default first row captured",
  async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("itwas-col-sort");
      window.localStorage.removeItem("itwas-col-widths");
    });
    await page.goto("/");
    await expect(page.locator(".results tbody tr").first()).toBeVisible({
      timeout: 15_000,
    });
    store.defaultFirst = (await firstChangeId(page).textContent()) ?? "";
    // Default order is newest-first with no aria-sort marker.
    await expect(page.locator("th[aria-sort='ascending']")).toHaveCount(0);
  },
);

When("I click the {string} column sort header", async ({ page }, key: string) => {
  await page.locator(`[data-testid="sort-${key}"]`).click();
});

// Registered as Then: in the feature it follows a Then via "And".
Then("I click the date column sort header a second time", async ({ page }) => {
  await page.locator("[data-testid='sort-date']").click();
});

Then("the date column is marked ascending", async ({ page }) => {
  await expect(sortedDateHeader(page)).toHaveAttribute("aria-sort", "ascending");
});

Then("the date column is marked descending", async ({ page }) => {
  await expect(sortedDateHeader(page)).toHaveAttribute("aria-sort", "descending");
});

Then("the first visible change id differs from the captured default", async ({ page }) => {
  const text = (await firstChangeId(page).textContent()) ?? "";
  expect(text).toBeTruthy();
  expect(text).not.toBe(store.defaultFirst);
});

Then("the first visible change id equals the captured default", async ({ page }) => {
  await expect(firstChangeId(page)).toHaveText(store.defaultFirst ?? "");
});
