import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

function firstRow(page: Page) {
  return page.locator(".results tbody tr").first();
}

Given("the app is loaded with a tiny {string} cutoff override", async ({ page }, maxdiff: string) => {
  const params = new URLSearchParams({ maxdiff, q: "search" });
  await page.goto(`/?${params.toString()}`);
  await expect(page.locator(".results tbody tr").first()).toBeVisible({
    timeout: 15_000,
  });
});

Given("a result row is selected", async ({ page }) => {
  await firstRow(page).click();
});

Then("the large-diff cutoff notice appears", async ({ page }) => {
  await expect(page.locator("[data-testid='cutoff-notice']")).toBeVisible();
});

When('I click "try rich view anyway"', async ({ page }) => {
  await page.locator("[data-testid='rich-view']").click();
});

Then("the cutoff notice disappears", async ({ page }) => {
  await expect(page.locator("[data-testid='cutoff-notice']")).toBeHidden({
    timeout: 10_000,
  });
});
