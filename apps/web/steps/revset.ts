import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

function revsetInput(page: import("@playwright/test").Page) {
  return page.locator("input[placeholder='all()']");
}

When("I focus the revset field and type {string}", async ({ page }, text: string) => {
  const input = revsetInput(page);
  await input.click();
  await input.pressSequentially(text, { delay: 40 });
});

When("I pick the {string} suggestion", async ({ page }, label: string) => {
  const option = page.getByRole("option", { name: label }).or(page.locator("[data-part='content'], [role='listbox']").getByText(label, { exact: true }));
  await option.first().click();
});

Then("the revset field equals {string}", async ({ page }, value: string) => {
  await expect(revsetInput(page)).toHaveValue(value, { timeout: 5_000 });
});

When("I type {string} into the revset field directly", async ({ page }, text: string) => {
  await revsetInput(page).fill(text);
});
