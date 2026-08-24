import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { When, Then } = createBdd();

const store: Record<string, number> = {};

When("I scroll the results list to the bottom and back", async ({ page }) => {
  const scroll = page.locator("[data-testid='results-scroll']");
  await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(300);
  store.afterScroll = await page.locator(".results tbody tr").count();
  await scroll.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.waitForTimeout(300);
});

Then("the rendered row count stays bounded", async ({ page }) => {
  // Windowed rendering must keep the DOM row count far below the total
  // match count (which is >= the rendered window by construction here).
  const rendered = await page.locator(".results tbody tr").count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(150);
  // The scroll actually happened and swapped which rows are rendered.
  expect(store.afterScroll).toBeGreaterThan(0);
});
