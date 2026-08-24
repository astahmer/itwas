import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { waitForResults } from "./common";

const { Given, When, Then } = createBdd();

function selectedRow(page: Page) {
  return page.locator(".results tbody tr.selected");
}

When("I press ArrowDown in the query input", async ({ page }) => {
  await page.locator("input[aria-label='query']").press("ArrowDown");
});

When("I press ArrowDown again on the focused row", async ({ page }) => {
  await selectedRow(page).press("ArrowDown");
});

When("I press ArrowUp on the selected row", async ({ page }) => {
  await selectedRow(page).press("ArrowUp");
});

Then("the focused element is the selected result row", async ({ page }) => {
  const isFocusedSelected = await page.evaluate(() => {
    const active = document.activeElement;
    return (
      active?.tagName === "TR" && (active as HTMLElement).classList.contains("selected")
    );
  });
  expect(isFocusedSelected).toBe(true);
});

Then("a later row becomes selected", async ({ page }) => {
  const index = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".results tbody tr"));
    return rows.findIndex((row) => row.classList.contains("selected"));
  });
  expect(index).toBeGreaterThan(0);
});

Then("the first row is selected again", async ({ page }) => {
  const index = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".results tbody tr"));
    return rows.findIndex((row) => row.classList.contains("selected"));
  });
  expect(index).toBe(0);
});
