const { test, expect } = require("@playwright/test");
const { loadDiagnostic, getVacancyNumber, answerAll, openGate, fillGate, VACANCY } = require("./helpers");

/*
  Every request to formspree.io is intercepted in loadDiagnostic, so these assertions
  read the payload the page *would* have sent without anything leaving the
  machine or reaching a real inbox.
*/
test.describe("the lead that goes to Formspree", () => {
  test("is posted once, as JSON, to the configured form", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    const requests = [];
    page.on("request", request => {
      if (request.url().includes("formspree.io")) requests.push(request);
    });

    await getVacancyNumber(page);
    await answerAll(page);
    await openGate(page);
    await fillGate(page);
    await page.locator("#contactGate button[type=submit]").click();
    await expect(page.locator("#results")).toHaveClass(/show/);
    await expect.poll(() => submissions.length).toBe(1);

    expect(requests).toHaveLength(1);
    expect(requests[0].method()).toBe("POST");
    expect(requests[0].url()).toMatch(/^https:\/\/formspree\.io\/f\/\w+$/);
    expect(await requests[0].headerValue("content-type")).toContain("application/json");
    expect(await requests[0].headerValue("accept")).toContain("application/json");
  });

  test("is labelled in plain titles, in reading order, with no JSON blob", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    await getVacancyNumber(page, VACANCY.larger);
    await answerAll(page);
    await openGate(page);
    const details = await fillGate(page);
    await page.locator("#contactGate button[type=submit]").click();
    await expect.poll(() => submissions.length).toBe(1);
    const lead = submissions[0];

    /* Formspree renders rows in the order they arrive, so order is part of the
       output, not an accident. */
    expect(Object.keys(lead)).toEqual([
      "_subject", "_replyto",
      "Name", "Work Email",
      "Hiring Clarity Score", "Risk Tier", "Vacancy Cost Estimate",
      "Priority Levers", "Diagnostic Answers", "Submitted", "Page",
    ]);
    /* The raw record used to ride along and made the email unreadable. */
    expect(lead.fullRecord).toBeUndefined();
    for (const key of Object.keys(lead)) {
      if (key.startsWith("_")) continue;
      expect(key, "labels are titles, not identifiers").toMatch(/^[A-Z][A-Za-z -]*$/);
    }

    expect(lead["Name"]).toBe(details.name);
    expect(lead["Work Email"]).toBe(details.email);
    expect(lead["Hiring Clarity Score"]).toBe("18 / 40");
    expect(lead["Risk Tier"]).toBe("Developing");
    expect(lead["Vacancy Cost Estimate"]).toBe(VACANCY.larger.total);
    expect(lead["Page"]).toContain("http");
    expect(lead["Submitted"]).toBeTruthy();
  });

  test("Reply goes back to the person who took it", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    await getVacancyNumber(page);
    await answerAll(page);
    await openGate(page);
    const details = await fillGate(page);
    await page.locator("#contactGate button[type=submit]").click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0]._replyto).toBe(details.email);
    expect(submissions[0]._subject).toBe(
      `Empty Seat Diagnostic: ${details.name} (18/40, Developing)`);
  });

  test("spells out all eight answers and the priority levers", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    await getVacancyNumber(page);
    await answerAll(page);
    await openGate(page);
    await fillGate(page);
    await page.locator("#contactGate button[type=submit]").click();
    await expect.poll(() => submissions.length).toBe(1);
    const lead = submissions[0];

    const numbered = lead["Diagnostic Answers"].split("\n\n");
    expect(numbered).toHaveLength(8);
    /* Full question text is kept deliberately -- it is what makes the email
       readable without opening the dashboard. */
    expect(numbered[0]).toMatch(/^1\. .+\?\n {3}-> .+ \(\d+(\.\d+)?\/10\)$/);
    expect(lead["Priority Levers"]).toMatch(/: \d+\/10/);
  });

  test("says so plainly when the calculator was not completed", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    await page.evaluate(() => { document.body.dataset.calculatorUsed = "true"; });
    await answerAll(page);
    await openGate(page);
    await fillGate(page);
    await page.locator("#contactGate button[type=submit]").click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0]["Vacancy Cost Estimate"]).toBe("Calculator not completed");
  });

  test("nothing is sent when a diagnostic is not completed", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    await getVacancyNumber(page);
    await page.locator("#options .option").first().click();
    await page.locator("#nextBtn").click();
    await page.waitForTimeout(500);
    expect(submissions).toEqual([]);
  });
});
