import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { waitForResults } from "./common";

const { Given, Then } = createBdd();

Then("the footer does not mention {string}", async ({ page }, phrase: string) => {
  const footerText = await page.locator("footer").textContent();
  expect(footerText ?? "").not.toContain(phrase);
});
