const { test, expect } = require("@playwright/test");
const { loadDiagnostic, getVacancyNumber, scrollPastHero } = require("./helpers");

const card = ".mn-scroll-prompt";
const cardButton = ".mn-scroll-prompt__button";

/** The card is faded rather than removed, so opacity is what "shown" means. */
const shown = page => page.locator(card).evaluate(el => {
  const style = getComputedStyle(el);
  return style.opacity !== "0" && style.pointerEvents !== "none";
});

test.describe("Michael's scroll prompt", () => {
  test("never appears over the hero", async ({ page }) => {
    await loadDiagnostic(page);
    /* Outlast any entrance delay before concluding it stayed away. */
    await page.waitForTimeout(2500);
    expect(await shown(page)).toBe(false);

    const heroHeight = await page.locator(".hero").evaluate(el => el.getBoundingClientRect().height);
    await page.evaluate(y => window.scrollTo(0, y), heroHeight - 100);
    await page.waitForTimeout(300);
    expect(await shown(page)).toBe(false);
  });

  test("boards once the hero is behind you", async ({ page }) => {
    await loadDiagnostic(page);
    await scrollPastHero(page);
    await expect.poll(() => shown(page)).toBe(true);
  });

  test("without a number, tapping it opens the calculator", async ({ page }) => {
    await loadDiagnostic(page);
    await scrollPastHero(page);
    await expect.poll(() => shown(page)).toBe(true);
    await expect(page.locator(cardButton)).toHaveAttribute("aria-label", "Open the Vacancy Cost Calculator");

    await page.locator(cardButton).click();
    await expect(page.locator("#costCalcDialog")).toBeVisible();
  });

  test("closing the calculator empty-handed leaves the reminder standing", async ({ page }) => {
    await loadDiagnostic(page);
    await scrollPastHero(page);
    await expect.poll(() => shown(page)).toBe(true);
    await page.locator(cardButton).click();
    await page.locator("#costCalcClose").click();
    await expect(page.locator("#costCalcDialog")).toBeHidden();
    await expect.poll(() => shown(page)).toBe(true);
  });

  test("with a number, tapping it goes to the diagnostic instead", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page);
    await scrollPastHero(page);
    await expect.poll(() => shown(page)).toBe(true);
    await expect(page.locator(cardButton))
      .toHaveAttribute("aria-label", "Go to the complimentary 5-minute diagnostic");

    await page.locator(cardButton).click();
    await expect(page.locator("#costCalcDialog")).toBeHidden();
    await expect.poll(async () =>
      Math.abs(await page.locator("#assessment").evaluate(el => el.getBoundingClientRect().top)) < 120
    ).toBe(true);
    await expect.poll(() => shown(page)).toBe(false);
  });

  test("steps off as soon as the first question is answered", async ({ page }) => {
    await loadDiagnostic(page);
    await getVacancyNumber(page);
    await scrollPastHero(page);
    await expect.poll(() => shown(page)).toBe(true);
    await page.locator("#options .option").first().click();
    await expect(page.locator("body")).toHaveAttribute("data-diagnostic-started", "true");
    await expect.poll(() => shown(page)).toBe(false);
  });
});
