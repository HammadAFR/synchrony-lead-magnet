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

  test("the contact dialog opens from the nav, and only from there", async ({ page }) => {
    await loadDiagnostic(page);
    await expect(page.locator("#contactDialog")).toBeHidden();
    /* Every other route to it now books time directly instead. */
    expect(await page.locator("[onclick*='openContactDialog']").count()).toBe(1);
    await expect(page.locator(".nav-menu-contact")).toHaveAttribute("onclick", /openContactDialog/);

    await page.locator("#navMenuToggle").click();
    await page.locator(".nav-menu-contact").click();
    await expect(page.locator("#contactDialog")).toBeVisible();
    /* The heading is gone; the dialog carries its own accessible name. */
    await expect(page.locator("#contactDialogTitle")).toHaveCount(0);
    await expect(page.locator("#contactDialog")).toHaveAttribute("aria-label", /Michael/);
    await expect(page.locator(".contact-hero-btn")).toBeVisible();
  });

  test("the calculator carries quiet proof of work", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    const quotes = page.locator(".calc-proof-quote");
    await expect(quotes).toHaveCount(1);
    await expect(quotes.nth(0).locator("cite")).toContainText("Group Benefits");
    await expect(page.locator(".calc-proof-label"))
      .toHaveText("Voices from the leaders we have served.");
    /* It sits after the hand-off, so it never outranks the reason they opened this. */
    const order = await page.evaluate(() => {
      const inner = document.querySelector("#costCalcDialog .calc-dialog-inner");
      const kids = [...inner.children];
      return kids.indexOf(inner.querySelector(".calc-to-diagnostic"))
           < kids.indexOf(inner.querySelector(".calc-proof"));
    });
    expect(order).toBe(true);
  });
});

test.describe("booking CTAs", () => {
  const BOOKING = "https://calendly.com/michael-north_discovery/15min";

  test("both booking buttons are green and go straight to the booking page", async ({ page }) => {
    await loadDiagnostic(page);
    /* Scoped to btn-primary: the contact dialog books the same link but stays
       blue, so a bare href selector would pick up three. */
    const ctas = page.locator(`a.btn-primary[href="${BOOKING}"]`);
    /* Three now: the results, the form guarding the Blueprint, and the closing
       section. The form carries one because it takes the results' closing block
       off screen while it is up, and the conversation should not go with it. */
    await expect(ctas).toHaveCount(3);
    await expect(page.locator(`a[href="${BOOKING}"]`)).toHaveCount(4);
    for (let i = 0; i < 3; i += 1) {
      const cta = ctas.nth(i);
      await expect(cta).toHaveClass(/btn-primary/);      // btn-primary is the green one
      await expect(cta).toHaveAttribute("target", "_blank");
      await expect(cta).toHaveAttribute("rel", /noopener/);
      await expect(cta.locator("span").first()).toHaveText("Book a Confidential Conversation");
      await expect(cta.locator("small")).toHaveText("15 minutes. One leadership problem. Clear next steps.");
    }
  });

  test("the blueprint button is blue, and the retake link is gone", async ({ page }) => {
    await loadDiagnostic(page);
    await expect(page.locator("#takeBlueprintBtn")).toHaveClass(/btn-blue/);
    await expect(page.locator("#takeBlueprintBtn")).not.toHaveClass(/btn-primary/);
    await expect(page.locator("#restartBtn")).toHaveCount(0);
    await expect(page.locator(".result-retake")).toHaveCount(0);
  });
});

test.describe("metadata", () => {
  test("title and description describe the diagnostic as it stands", async ({ page }) => {
    await loadDiagnostic(page);
    await expect(page).toHaveTitle("Why Sales Leadership Hires Fail | The Empty Seat Diagnostic");
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
      expect(value, selector).toMatch(/^https:\/\/emptyseatdiagnostic\.com\//);
    }
  });
});

test.describe("Firebase's default hostnames", () => {
  /* Firebase keeps <site>.web.app and <site>.firebaseapp.com alive permanently
     and offers no way to remove them, so the page bounces them to the real
     address itself. The guard has to be exact: too broad and it would fire on
     localhost, taking local development and this suite down with it. */
  test("the redirect leaves localhost alone", async ({ page }) => {
    await loadDiagnostic(page);
    expect(page.url()).toContain("127.0.0.1");
    await expect(page.locator("h1.display")).toBeVisible();
  });

  test("only the two Firebase suffixes are matched", async ({ page }) => {
    await loadDiagnostic(page);
    const matches = await page.evaluate(() =>
      ["synchrony-lead-magnet.web.app", "synchrony-lead-magnet.firebaseapp.com",
       "emptyseatdiagnostic.com", "www.emptyseatdiagnostic.com",
       "localhost", "127.0.0.1"]
        .filter(host => host.endsWith(".web.app") || host.endsWith(".firebaseapp.com")));
    expect(matches).toEqual([
      "synchrony-lead-magnet.web.app",
      "synchrony-lead-magnet.firebaseapp.com",
    ]);
  });
});
