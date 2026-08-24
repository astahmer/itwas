import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { When, Then } = createBdd();

const store: Record<string, string | undefined> = {};

function firstRow(page: Page) {
  return page.locator(".results tbody tr").first();
}

function selectedChangeId(page: Page) {
  return page
    .locator(".results tbody tr.selected")
    .locator(".change-id");
}

When("I click the row copy-id action on the first result", async ({ page }) => {
  store.selectedBefore = (await selectedChangeId(page).textContent()) ?? "";
  const action = firstRow(page).locator(
    "[aria-label^='copy change id']",
  );
  await action.click();
});

Then("the clipboard contains the first result's change id", async ({ page }) => {
  const changeId = (await firstRow(page).locator(".change-id").textContent()) ?? "";
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe(changeId);
});

Then("the selected row is unchanged", async ({ page }) => {
  const now = (await selectedChangeId(page).textContent()) ?? "";
  expect(now).toBe(store.selectedBefore);
});
