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

  test("a partial answer allows the diagnostic without counting as completed", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await page.fill("#costCalcRevenue", "2000000");
    await page.fill("#costCalcMonths", "6");
    /* Examples must not qualify as user inputs, but the diagnostic stays open. */
    await expect(page.locator("#costCalcToDiagnostic")).toBeEnabled();
    await expect(page.locator("#costCalcToDiagnosticNote"))
      .toHaveText("The diagnostic is available with or without a calculated cost.");
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
    await expect(page.locator("#costCalcToDiagnostic")).toBeEnabled();

    await page.fill("#costCalcHours", "10");
    await expect(page.locator("body")).toHaveAttribute("data-calculator-used", "true");
  });

  test("the breakdown splits revenue from executive coverage", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await expect(page.locator("#costCalcInsight"))
      .toContainText("Revenue at Risk:");
    await fillCalculator(page);
    await expect(page.locator("#costCalcInsight")).toContainText("Revenue at Risk:");
    await expect(page.locator("#costCalcInsight")).toContainText("Executive Coverage Cost:");
  });

  test("the assumptions cite their sources, clamped until asked for", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await page.fill("#costCalcRevenue", "");
    await page.fill("#costCalcMonths", "");
    await page.fill("#costCalcHours", "");
    const note = page.locator(".calc-method-text");
    const toggle = page.locator(".calc-method-toggle");
    await expect(note).toContainText("BLS wage and benefits data");
    await expect(note).toContainText("Sales Management Association");

    /* Two lines showing, the rest clamped away -- the box stays scannable. */
    const clamped = await note.evaluate(el => el.scrollHeight > el.clientHeight + 1);
    expect(clamped).toBe(true);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveText("Show less");
    const opened = await note.evaluate(el => el.scrollHeight <= el.clientHeight + 1);
    expect(opened).toBe(true);

    /* Every source is reachable and opens away from the diagnostic. */
    const links = note.locator("a");
    await expect(links).toHaveCount(4);
    for (let i = 0; i < 4; i += 1) {
      await expect(links.nth(i)).toHaveAttribute("target", "_blank");
      await expect(links.nth(i)).toHaveAttribute("rel", /noopener/);
    }
  });
});
