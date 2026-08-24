import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

const store: Record<string, string> = {};

function selectedChangeId(page: Page) {
  return page.locator(".results tbody tr.selected .change-id");
}

Given("a stable older revision whose change id is remembered", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".results tbody tr").first()).toBeVisible({
    timeout: 15_000,
  });
  // Pick a stable older revision from the API (virtualization makes DOM
  // row indexes unreliable for far-down rows).
  store.sel = await page.evaluate(async () => {
    const data = await (await fetch("/api/search?limit=200")).json();
    return data.results[data.results.length - 3].change_id;
  });
  expect(store.sel).toBeTruthy();
});

When("the app is loaded with that change id in the sel parameter", async ({ page }) => {
  await page.goto(`/?sel=${encodeURIComponent(store.sel)}`);
  await expect(selectedChangeId(page)).toHaveText(store.sel, {
    timeout: 15_000,
  });
});

Then("the row with that change id is selected", async ({ page }) => {
  await expect(selectedChangeId(page)).toHaveText(store.sel, {
    timeout: 10_000,
  });
});

When("I select a different revision using the keyboard", async ({ page }) => {
  const before = await selectedChangeId(page).textContent();
  await page.locator(".results tbody tr.selected").focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(
    (previous) =>
      document.querySelector(".results tbody tr.selected .change-id")
        ?.textContent !== previous,
    before,
    { timeout: 10_000 },
  );
  store.clicked = (await selectedChangeId(page).textContent()) ?? "";
  expect(store.clicked).toBeTruthy();
  expect(store.clicked).not.toBe(store.sel);
});

Then("the URL sel parameter matches the newly selected row", async ({ page }) => {
  await expect
    .poll(async () => new URL(page.url()).searchParams.get("sel") ?? "")
    .toBe(store.clicked);
});
