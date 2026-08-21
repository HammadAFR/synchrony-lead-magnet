const { test, expect } = require("@playwright/test");
const { loadDiagnostic, openCalculator, fillCalculator, getVacancyNumber,
        answerAll, fillGate, VACANCY } = require("./helpers");

test.describe("the lock in front of the diagnostic", () => {
  test("is closed on arrival and the questions cannot be reached", async ({ page }) => {
    await loadDiagnostic(page);
    await expect(page.locator("#assessmentLock")).toBeVisible();
    await expect(page.locator(".assessment-card")).toHaveClass(/is-locked/);
    await expect(page.locator(".assessment-content")).toHaveAttribute("inert", "");
  });

  test("opens once a real number is on the board", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page);
    await expect(page.locator("#assessmentLock")).toBeHidden();
    await expect(page.locator(".assessment-card")).not.toHaveClass(/is-locked/);
    await expect(page.locator(".assessment-content")).not.toHaveAttribute("inert", "");
  });

  test("closes again if a field is emptied before answering", async ({ page }) => {
    await loadDiagnostic(page);
    await openCalculator(page);
    await fillCalculator(page);
    await expect(page.locator("#assessmentLock")).toBeHidden();
    await page.fill("#costCalcMonths", "");
    await expect(page.locator("#assessmentLock")).toBeVisible();
    await expect(page.locator(".assessment-content")).toHaveAttribute("inert", "");
  });

  test("stays open once answering has begun, even if the fields are cleared", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page);
    await page.locator("#options .option").first().click();
    await expect(page.locator("body")).toHaveAttribute("data-diagnostic-started", "true");

    await openCalculator(page);
    await page.fill("#costCalcRevenue", "");
    await page.fill("#costCalcMonths", "");
    await page.fill("#costCalcHours", "");
    await page.locator("#costCalcClose").click();
    /* Slamming the door on someone mid-answer would lose their progress. */
    await expect(page.locator("#assessmentLock")).toBeHidden();
  });
});

test.describe("running the diagnostic", () => {
  test("eight questions lead to the contact gate", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page);
    await expect(page.locator("#stepLabel")).toHaveText("Question 1 of 8");
    await answerAll(page);
    await expect(page.locator("#questionView")).toBeHidden();
  });

  test("the last step is labelled as the finish", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page);
    for (let step = 1; step < 8; step += 1) {
      await page.locator("#options .option").first().click();
      await page.locator("#nextBtn").click();
    }
    await expect(page.locator("#nextBtn")).toHaveText("Complete Diagnostic");
  });

  test("submitting the gate scores, ranks and opens the blueprint", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page);
    await answerAll(page);
    await fillGate(page);
    await page.locator("#contactGate button[type=submit]").click();

    await expect(page.locator("#results")).toHaveClass(/show/);
    /* Index 0 everywhere scores 37/80 -> 46% -> 18/40, which lands in Developing. */
    await expect(page.locator("#tier")).toHaveText("Developing");
    await expect(page.locator("#score")).toHaveText("18", { timeout: 5000 });
    await expect(page.locator("#dimensionList .dimension-row")).toHaveCount(4);
    await expect(page.locator("#primaryLever")).not.toHaveText("—");
    await expect(page.locator("#recommendations li").first()).toContainText("Start with Lever");
    await expect(page.locator("#blueprint")).not.toHaveAttribute("hidden", "");
  });

  test("the results quote the figure from the calculator", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page, VACANCY.larger);
    await answerAll(page);
    await fillGate(page);
    await page.locator("#contactGate button[type=submit]").click();
    await expect(page.locator("#resultCostValue")).toHaveText(VACANCY.larger.total);
  });

  test("finishing retires the hero nudge for the rest of the visit", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page);
    await answerAll(page);
    await fillGate(page);
    await page.locator("#contactGate button[type=submit]").click();
    await expect(page.locator("body")).toHaveAttribute("data-diagnostic-taken", "true");
  });
});
