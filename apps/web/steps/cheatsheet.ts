import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { When, Then } = createBdd();

const store: Record<string, string> = {};

function revsetInput(page: Page) {
  return page.locator("input[placeholder='all()']");
}

When("I open the help popover and switch to the Revsets tab", async ({ page }) => {
  await page.locator("[aria-label='what do the lanes mean?']").click();
  await page.locator("[data-testid='tab-revsets']").click();
});

When("I click the first cheat-sheet token", async ({ page }) => {
  const token = page.locator("[data-testid='cheatsheet-token']").first();
  store.token = (await token.textContent()) ?? "";
  await token.click();
});

Then("the revset field contains that token", async ({ page }) => {
  await expect(revsetInput(page)).toHaveValue(store.token, { timeout: 5_000 });
});
