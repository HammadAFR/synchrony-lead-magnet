const { test, expect } = require("@playwright/test");
const { loadDiagnostic, openCalculator, fillCalculator, VACANCY } = require("./helpers");

test.describe("vacancy cost calculator", () => {
  test("opens from the hero CTA", async ({ page }) => {
    await loadDiagnostic(page);
    await expect(page.locator("#costCalcDialog")).toBeHidden();
    await openCalculator(page);
    await expect(page.locator("#costCalcTitle")).toBeVisible();
  });

  test.describe("arithmetic", () => {
    for (const [name, values] of Object.entries(VACANCY)) {
      test(`${name} inputs total ${values.total}`, async ({ page }) => {
        await loadDiagnostic(page);
        await openCalculator(page);
        await fillCalculator(page, values);
        await expect(page.locator("#costCalcTotal")).toHaveText(values.total);
      });
    }
  });

  test("a partial answer will not unlock anything", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await page.fill("#costCalcRevenue", "2000000");
    await page.fill("#costCalcMonths", "6");
    /* Two of three fields already puts a figure on screen -- the way through
       must stay shut until it is a real one. */
    await expect(page.locator("#costCalcToDiagnostic")).toBeDisabled();
    await expect(page.locator("#costCalcToDiagnosticNote"))
      .toHaveText("Fill in all three inputs to get your number and unlock the diagnostic.");
    await expect(page.locator("body")).not.toHaveAttribute("data-calculator-used", "true");
  });

  test("all three fields open the way through", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await fillCalculator(page);
    await expect(page.locator("#costCalcToDiagnostic")).toBeEnabled();
    await expect(page.locator("#costCalcToDiagnosticNote")).toHaveText("");
    await expect(page.locator("body")).toHaveAttribute("data-calculator-used", "true");
  });

  test("emptying any field takes the number away again", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await fillCalculator(page);
    await expect(page.locator("body")).toHaveAttribute("data-calculator-used", "true");

    await page.fill("#costCalcHours", "");
    await expect(page.locator("body")).not.toHaveAttribute("data-calculator-used", "true");
    await expect(page.locator("#costCalcToDiagnostic")).toBeDisabled();

    await page.fill("#costCalcHours", "10");
    await expect(page.locator("body")).toHaveAttribute("data-calculator-used", "true");
  });

  test("the breakdown splits revenue from executive coverage", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await expect(page.locator("#costCalcInsight"))
      .toContainText("Enter your numbers to see your estimated cost of waiting.");
    await fillCalculator(page);
    await expect(page.locator("#costCalcInsight")).toContainText("Revenue at Risk:");
    await expect(page.locator("#costCalcInsight")).toContainText("Executive Coverage Cost:");
  });
});
