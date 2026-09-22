const { test, expect } = require("@playwright/test");
const { loadDiagnostic, openCalculator, fillCalculator, getVacancyNumber, answerAll, openGate, fillGate, VACANCY } = require("./helpers");

/* The Google tag itself is blocked in tests, but the inline snippet still
   defines gtag() and dataLayer, so every event the page fires lands in
   dataLayer and can be read back. That is what these assert: the funnel is
   measured at the points that matter, each step fires once, and a blocked or
   missing tag can never break the diagnostic. */

/** Every event name pushed to dataLayer, in order. */
function events(page) {
  return page.evaluate(() =>
    (window.dataLayer || [])
      .filter(a => a[0] === "event")
      .map(a => ({ name: a[1], params: a[2] || {} })));
}

test.describe("funnel measurement", () => {
  test("opening and completing the calculator each report once", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await fillCalculator(page, VACANCY.standard);
    await expect(page.locator("body")).toHaveAttribute("data-calculator-used", "true");

    const fired = await events(page);
    const opened = fired.filter(e => e.name === "calculator_opened");
    const done = fired.filter(e => e.name === "calculator_completed");

    expect(opened).toHaveLength(1);
    expect(opened[0].params.source).toBe("dialog");

    /* Typing three numbers must not report three completions. */
    expect(done).toHaveLength(1);
    expect(done[0].params.value).toBe(251960);
    expect(done[0].params.currency).toBe("USD");
  });

  test("the standalone page reports the same two steps", async ({ page }) => {
    await loadDiagnostic(page);
    await page.goto("/vacancy-cost-calculator/", { waitUntil: "domcontentloaded" });
    await page.fill("#pageRevenue", VACANCY.larger.revenue);
    await page.fill("#pageMonths", VACANCY.larger.months);
    await page.fill("#pageHours", VACANCY.larger.hours);
    await expect(page.locator("#pageSplit")).toBeVisible();

    const fired = await events(page);
    const opened = fired.filter(e => e.name === "calculator_opened");
    const done = fired.filter(e => e.name === "calculator_completed");

    expect(opened).toHaveLength(1);
    /* Same event names, different source, so the two routes are comparable. */
    expect(opened[0].params.source).toBe("page");
    expect(done).toHaveLength(1);
    expect(done[0].params.source).toBe("page");
    expect(done[0].params.value).toBe(385293);
  });

  test("the diagnostic reports starting, finishing, and the lead", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await fillCalculator(page, VACANCY.standard);
    await page.locator("#costCalcClose").click();

    await answerAll(page);
    /* Answering eight questions must report one start, not eight. */
    expect((await events(page)).filter(e => e.name === "diagnostic_started")).toHaveLength(1);

    await openGate(page);
    await fillGate(page);
    await page.locator("#contactGate button[type=submit]").click();
    await expect(page.locator("#results")).toBeVisible();

    const fired = await events(page);
    const completed = fired.filter(e => e.name === "diagnostic_completed");
    const lead = fired.filter(e => e.name === "lead_submitted");

    expect(completed).toHaveLength(1);

    expect(lead).toHaveLength(1);
    /* The lead carries the figure the visitor saw, so revenue can be attributed
       to the funnel rather than counted as a bare conversion. */
    expect(lead[0].params.value).toBe(251960);
    expect(lead[0].params.calculator_used).toBe(true);
  });

  test("finishing the questions is its own step, separate from the lead", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page);
    await answerAll(page);
    await expect(page.locator("#results")).toHaveClass(/show/);

    /* Finishing the questions is now its own step, reported before anyone is
       asked for anything -- which is what makes abandonment at the form
       visible rather than indistinguishable from losing interest. */
    let fired = await events(page);
    expect(fired.filter(e => e.name === "diagnostic_completed")).toHaveLength(1);
    expect(fired.filter(e => e.name === "lead_submitted")).toHaveLength(0);
    expect(fired.filter(e => e.name === "blueprint_opened")).toHaveLength(0);

    await openGate(page);
    await fillGate(page);
    await page.locator("#contactGate button[type=submit]").click();
    await expect(page.locator("#blueprint")).toBeVisible();

    fired = await events(page);
    expect(fired.filter(e => e.name === "lead_submitted")).toHaveLength(1);
    expect(fired.filter(e => e.name === "blueprint_opened")).toHaveLength(1);

    fired = await events(page);
    expect(fired.filter(e => e.name === "lead_submitted")).toHaveLength(1);
    expect(fired.filter(e => e.name === "blueprint_opened")).toHaveLength(1);
  });

  test("being turned away at the gate is measured, with the reason", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page);
    await answerAll(page);
    await openGate(page);
    await fillGate(page, { email: "someone@gmail.com" });
    await page.locator("#email").blur();
    await expect(page.locator("#emailError")).toContainText("work email");

    const blocked = (await events(page)).filter(e => e.name === "gate_blocked");
    expect(blocked.length).toBeGreaterThanOrEqual(1);
    expect(blocked[0].params.reason).toBe("consumer_address");
  });

  test("booking clicks are caught wherever the button lives", async ({ page }) => {
    await loadDiagnostic(page);
    /* Delegated on the destination, not a class, so a fourth CTA is measured
       the day someone adds it. */
    const caught = await page.evaluate(() => {
      const link = document.querySelector('a[href*="calendly.com"]');
      link.removeAttribute("target");
      link.addEventListener("click", e => e.preventDefault(), true);
      link.click();
      return (window.dataLayer || []).filter(a => a[0] === "event" && a[1] === "booking_clicked").length;
    });
    expect(caught).toBe(1);
  });

  test("a blocked tag cannot break the page", async ({ page }) => {
    /* Ad blockers stop the Google tag for a real share of visitors. track()
       must be a no-op in that case, not an exception that halts the script. */
    const { problems } = await loadDiagnostic(page);
    await page.evaluate(() => { window.gtag = undefined; });
    await openCalculator(page);
    await fillCalculator(page, VACANCY.standard);
    await expect(page.locator("body")).toHaveAttribute("data-calculator-used", "true");
    await page.locator("#costCalcClose").click();
    await answerAll(page);
    await expect(page.locator("#results")).toHaveClass(/show/);
    expect(problems).toEqual([]);
  });
});
