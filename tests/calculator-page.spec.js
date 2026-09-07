const { test, expect } = require("@playwright/test");
const { loadDiagnostic, VACANCY } = require("./helpers");

const PAGE = "/vacancy-cost-calculator/";

/* The calculator on its own URL. It exists so the tool is linkable and
   indexable in its own right, so these tests care about three things: it is a
   real page rather than a copy of the dialog, it produces the same number the
   dialog does, and someone who fills it in is not asked the same three
   questions again when they reach the diagnostic. */

async function fillPage(page, values = VACANCY.standard) {
  await page.fill("#pageRevenue", values.revenue);
  await page.fill("#pageMonths", values.months);
  await page.fill("#pageHours", values.hours);
}

test.describe("standalone vacancy cost calculator", () => {
  test("it is served, and describes itself as its own page", async ({ page, request }) => {
    const response = await request.get(PAGE);
    expect(response.status()).toBe(200);

    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Sales Leadership Vacancy Cost Calculator/);

    /* Its own canonical, not the home page's -- otherwise Google folds the two
       together and the point of a separate URL is lost. */
    await expect(page.locator('link[rel="canonical"]'))
      .toHaveAttribute("href", "https://emptyseatdiagnostic.com/vacancy-cost-calculator/");
    await expect(page.locator('meta[property="og:url"]'))
      .toHaveAttribute("content", "https://emptyseatdiagnostic.com/vacancy-cost-calculator/");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("the calculator is inline, not behind a dialog", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    /* Someone arriving from a search result should meet the tool, not a button
       that opens it. */
    await expect(page.locator("#pageRevenue")).toBeVisible();
    await expect(page.locator("#pageMonths")).toBeVisible();
    await expect(page.locator("#pageHours")).toBeVisible();
    await expect(page.locator("dialog")).toHaveCount(0);
  });

  test("it produces the same number as the dialog", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    await fillPage(page, VACANCY.standard);
    await expect(page.locator("#pageTotal")).toHaveText(VACANCY.standard.total);

    await fillPage(page, VACANCY.larger);
    await expect(page.locator("#pageTotal")).toHaveText(VACANCY.larger.total);
  });

  test("the breakdown appears only once all three are answered", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#pageSplit")).toBeHidden();
    await expect(page.locator("#pageEmpty")).toBeVisible();

    /* One number typed into one box is not an estimate. */
    await page.fill("#pageRevenue", VACANCY.standard.revenue);
    await expect(page.locator("#pageSplit")).toBeHidden();

    await fillPage(page, VACANCY.standard);
    await expect(page.locator("#pageSplit")).toBeVisible();
    await expect(page.locator("#pageEmpty")).toBeHidden();
    await expect(page.locator("#pageRevenueDrag")).toHaveText("$200,000");
    await expect(page.locator("#pageCoverage")).toHaveText("$51,960");
  });

  test("the number carries over to the diagnostic", async ({ page }) => {
    /* Routes are registered on the page, so they survive the navigation. */
    await loadDiagnostic(page);
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    await fillPage(page, VACANCY.larger);
    await expect(page.locator("#pageTotal")).toHaveText(VACANCY.larger.total);

    await page.locator("#pageToDiagnostic").click();
    await expect(page.locator("h1.display")).toBeVisible();

    /* The whole point of the handoff: the diagnostic is already unlocked and
       nobody has been asked for the same three figures twice. */
    await expect(page.locator("body")).toHaveAttribute("data-calculator-used", "true");
    await expect(page.locator("#costCalcRevenue")).toHaveValue(VACANCY.larger.revenue);
    await expect(page.locator("#costCalcMonths")).toHaveValue(VACANCY.larger.months);
    await expect(page.locator("#costCalcHours")).toHaveValue(VACANCY.larger.hours);
  });

  test("returning to the calculator keeps what was already entered", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    await fillPage(page, VACANCY.standard);
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#pageRevenue")).toHaveValue(VACANCY.standard.revenue);
    await expect(page.locator("#pageTotal")).toHaveText(VACANCY.standard.total);
  });

  test("the assumptions are stated, with their sources reachable", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    const method = page.locator(".calc-page-method");
    await expect(method).toContainText("How this is calculated");
    /* A number nobody can check is a number nobody can use. */
    await expect(method).toContainText("20%");
    await expect(method).toContainText("$200");
    for (const host of ["gallup.com", "bls.gov", "heidrick.com", "salesmanagement.org"]) {
      await expect(method.locator(`a[href*="${host}"]`).first()).toHaveAttribute("target", "_blank");
    }
  });

  test("it is listed in the sitemap", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("https://emptyseatdiagnostic.com/vacancy-cost-calculator/");
  });

  test("its structured data parses and points at the shared organisation", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(raw);
    expect(data["@type"]).toBe("WebApplication");
    /* Referenced by @id rather than restated, so the two pages describe one
       business rather than two. */
    expect(data.provider["@id"]).toBe("https://synchronytalent.com/#organization");
  });
});
