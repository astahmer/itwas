import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

When("I click the lane help button", async ({ page }) => {
  await page.locator("[aria-label='what do the lanes mean?']").click();
});

Then(
  "the popover mentions {string}, {string} and {string}",
  async ({ page }, one: string, two: string, three: string) => {
    for (const word of [one, two, three]) {
      await expect(page.locator(".lane-help").getByText(word).first()).toBeVisible();
    }
  },
);
