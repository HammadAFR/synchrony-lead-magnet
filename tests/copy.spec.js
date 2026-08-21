const { test, expect } = require("@playwright/test");
const { loadDiagnostic, openCalculator } = require("./helpers");

test.describe("headline copy", () => {
  test("the nav sets 'Empty Seat' in italic green", async ({ page }) => {
    await loadDiagnostic(page);
    const name = page.locator(".nav-diagnostic-name span");
    await expect(name).toHaveText("The Empty Seat Diagnostic");
    const em = name.locator("em");
    await expect(em).toHaveText("Empty Seat");
    await expect(em).toHaveCSS("font-style", "italic");
    /* Green in both themes, just a different step of it. */
    for (const theme of ["light", "dark"]) {
      await page.evaluate(t => document.documentElement.setAttribute("data-theme", t), theme);
      const [r, g, b] = (await em.evaluate(el => getComputedStyle(el).color))
        .match(/\d+/g).map(Number);
      expect(g, `green channel dominates in ${theme}`).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    }
  });

  test("the hero CTA shows one fixed title, no carousel", async ({ page }) => {
    await loadDiagnostic(page);
    const cta = page.locator(".hero-actions .calc-cta-btn");
    await expect(cta.locator(".cta-title")).toHaveText("What's this vacancy costing you?");
    await expect(cta.locator("small")).toHaveText("No email. No forms. Just the cost of waiting.");
    await expect(page.locator(".cta-slide, .cta-track, .cta-carousel")).toHaveCount(0);
    /* The rotation is gone; only the button's own glow should remain. */
    const anim = await cta.locator(".cta-title").evaluate(el => getComputedStyle(el).animationName);
    expect(anim).toBe("none");
  });

  test("the calculator hands off with the 8-question framing", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await expect(page.locator(".calc-to-diagnostic-lead"))
      .toHaveText("Three inputs give you the cost. The 8-question diagnostic shows you what's driving it.");
    await expect(page.locator("#costCalcToDiagnostic")).toHaveText("Diagnose What's Driving The Cost");
  });

  test("the contact dialog asks them to choose what to fix", async ({ page }) => {
    await loadDiagnostic(page);
    await page.locator("#navMenuToggle").click();
    await page.locator(".nav-menu-contact").click();
    const title = page.locator("#contactDialogTitle");
    await expect(title).toBeVisible();
    await expect(title).toHaveText("You've seen what may be costing you. Now decide what to fix first.");
    await expect(title.locator("em")).toHaveText("Now decide what to fix first.");
  });
});

test.describe("metadata", () => {
  test("title and description describe the diagnostic as it stands", async ({ page }) => {
    await loadDiagnostic(page);
    await expect(page).toHaveTitle("The Empty Seat Diagnostic | Synchrony Talent Partners");
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toContain("Empty Seat Diagnostic");
    expect(description).not.toMatch(/leak|Revenue Leadership/i);
    /* Google truncates past roughly 160 characters. */
    expect(description.length).toBeLessThanOrEqual(160);
  });

  test("link previews are complete", async ({ page }) => {
    await loadDiagnostic(page);
    for (const property of ["og:type", "og:site_name", "og:title", "og:description",
                            "og:url", "og:image", "og:image:alt"]) {
      const content = await page.locator(`meta[property="${property}"]`).getAttribute("content");
      expect(content, property).toBeTruthy();
    }
    for (const name of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
      expect(await page.locator(`meta[name="${name}"]`).getAttribute("content"), name).toBeTruthy();
    }
    /* Scrapers reject relative image URLs, and a stale host breaks every share. */
    for (const selector of ['meta[property="og:image"]', 'meta[property="og:url"]', 'link[rel="canonical"]']) {
      const value = await page.locator(selector).getAttribute("content")
        ?? await page.locator(selector).getAttribute("href");
      expect(value, selector).toMatch(/^https:\/\//);
    }
  });
});
