import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { waitForResults } from "./common";

const { Given, When, Then } = createBdd();

When("I click the copy-path button on the first row that has one", async ({ page }) => {
  // Use a row below the sticky header to avoid overlay interception.
  const buttons = page.locator("button[aria-label^='copy path']");
  const count = await buttons.count();
  const index = Math.min(count - 1, 6);
  const button = buttons.nth(index);
  await expect(button).toBeAttached();
  await button.scrollIntoViewIfNeeded();
  store_path(await button.getAttribute("aria-label"));
  await button.click({ force: true });
});

function store_path(label: string | null) {
  // stash on globalThis so the Then step can compare without extra fixtures
  (globalThis as Record<string, unknown>).__copiedLabel = label;
}

Then("the clipboard contains a non-empty file path", async ({ page }) => {
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.trim().length).toBeGreaterThan(0);
  expect(text).not.toContain(" ");
  const label = String((globalThis as Record<string, unknown>).__copiedLabel ?? "");
  // aria-label is `copy path <path>`; clipboard must equal the path part
  expect(label.endsWith(text)).toBe(true);
});
