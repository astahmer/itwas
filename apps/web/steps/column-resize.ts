import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { When, Then } = createBdd();

When(
  "I drag the {string} column resize handle right by {int}px",
  async ({ page }, label: string, px: number) => {
    const handle = page.locator(`[aria-label="resize ${label} column"]`);
    await handle.scrollIntoViewIfNeeded();
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + px, box.y + box.height / 2, {
      steps: 5,
    });
    await page.mouse.up();
  },
);

Then(
  "localStorage key {string} has a numeric {string} entry",
  async ({ page }, key: string, column: string) => {
    const raw = await page.evaluate((k) => window.localStorage.getItem(k), key);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(typeof parsed[column]).toBe("number");
    expect(parsed[column]).toBeGreaterThan(48);
  },
);
