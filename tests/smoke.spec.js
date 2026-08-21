const { test, expect } = require("@playwright/test");
const { loadDiagnostic } = require("./helpers");

test.describe("page loads cleanly", () => {
  test("no script errors and the hero renders", async ({ page }) => {
    const { problems } = await loadDiagnostic(page);
    await expect(page.locator("h1.display")).toContainText("sales leadership vacancy");
    await expect(page.locator(".hero-actions .calc-cta-btn")).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("nav carries the diagnostic name and its subtitle", async ({ page }) => {
    await loadDiagnostic(page);
    await expect(page.locator(".nav-diagnostic-name span")).toHaveText("The Empty Seat Diagnostic");
    await expect(page.locator(".nav-diagnostic-name small")).toHaveText("Uncover the hidden cost no one tracks");
  });

  test("the hero leads with the headline, not an eyebrow", async ({ page }) => {
    await loadDiagnostic(page);
    await expect(page.locator(".hero .eyebrow")).toHaveCount(0);
    const firstChild = await page.locator(".hero-copy").evaluate(el => el.firstElementChild.tagName);
    expect(firstChild).toBe("H1");
  });

  test("every section the funnel depends on is present", async ({ page }) => {
    await loadDiagnostic(page);
    for (const selector of [".hero", "#why-diagnostic", "#areas", "#assessment",
                            "#testimonials", "#costCalcDialog", "#contactDialog"]) {
      await expect(page.locator(selector)).toHaveCount(1);
    }
    /* The blueprint exists but stays hidden until the diagnostic is finished. */
    await expect(page.locator("#blueprint")).toHaveAttribute("hidden", "");
  });

  test("the theme toggle flips both ways", async ({ page }) => {
    await loadDiagnostic(page);
    const root = page.locator("html");
    const start = await root.getAttribute("data-theme");
    expect(["light", "dark"]).toContain(start);
    await page.locator(".theme-toggle").click();
    await expect(root).not.toHaveAttribute("data-theme", start);
    await page.locator(".theme-toggle").click();
    await expect(root).toHaveAttribute("data-theme", start);
  });

  test("nothing overflows sideways", async ({ page }) => {
    await loadDiagnostic(page);
    const overflows = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBe(false);
  });
});
