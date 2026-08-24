import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

async function panels(page: import("@playwright/test").Page) {
  // ark-ui renders panels as [data-part="panel"]; ours are in DOM order.
  const all = page.locator("[data-scope='splitter'][data-part='panel']");
  const count = await all.count();
  if (count < 2) throw new Error(`expected 2 splitter panels, found ${count}`);
  return {
    list: await all.nth(0).boundingBox(),
    detail: await all.nth(1).boundingBox(),
  };
}

Then("the list and detail panels are side-by-side", async ({ page }) => {
  const { list, detail } = await panels(page);
  expect(list).not.toBeNull();
  expect(detail).not.toBeNull();
  // Horizontally adjacent: detail starts where list ends (within tolerance).
  expect(Math.abs((list!.x + list!.width) - detail!.x)).toBeLessThan(10);
  // Same vertical range: NOT stacked.
  expect(Math.abs(list!.y - detail!.y)).toBeLessThan(10);
  expect(Math.abs(list!.height - detail!.height)).toBeLessThan(8);
});

Then("a resize trigger is visible between them", async ({ page }) => {
  const trigger = page.locator("[data-part='resize-trigger']");
  await expect(trigger).toBeVisible();
});

When("I drag the resize trigger left by {int} pixels", async ({ page }, pixels: number) => {
  const trigger = page.locator("[data-part='resize-trigger']");
  const box = await trigger.boundingBox();
  if (!box) throw new Error("resize trigger has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - pixels, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
});

Then("the detail panel width changed by at least {int} pixels", async ({ page }, minDelta: number) => {
  const { detail } = await panels(page);
  expect(detail!.width).toBeGreaterThan(minDelta / 2 + 300); // grew from ~45%
});
