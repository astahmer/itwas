import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

When("I click the date addon next to {string}", async ({ page }, field: string) => {
  const row = page
    .locator(".field-row")
    .filter({ has: page.locator(`input[aria-label='${field} date']`) });
  await row.locator("[aria-label='pick a date']").click();
});

Then(
  "the popover shows preset buttons including {string}",
  async ({ page }, label: string) => {
    await expect(page.locator(".date-presets button", { hasText: label })).toBeVisible();
  },
);

When("I click the {string} preset", async ({ page }, label: string) => {
  await page.locator(".date-presets button", { hasText: label }).click();
});

Then("the after input contains a YYYY-MM-DD date", async ({ page }) => {
  const value = await page.locator("input[aria-label='after date']").inputValue();
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
