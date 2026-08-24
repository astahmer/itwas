import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { waitForResults } from "./common";

const { Given, When, Then } = createBdd();

When("I click the theme toggle", async ({ page }) => {
  await page.locator("[aria-label='toggle light/dark theme']").click();
});

Then("documentElement data-mode flips from dark to light", async ({ page }) => {
  const mode = await page.evaluate(() => document.documentElement.dataset.mode);
  expect(mode).toBe("light");
});

When("I reload the page", async ({ page }) => {
  await page.reload();
  await waitForResults(page);
});

Then("data-mode is still light", async ({ page }) => {
  const mode = await page.evaluate(() => document.documentElement.dataset.mode);
  expect(mode).toBe("light");
});
