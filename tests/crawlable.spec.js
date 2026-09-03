const { test, expect } = require("@playwright/test");
const { loadDiagnostic } = require("./helpers");

/* The diagnostic's questions and lever copy live in app.js, so a reader that
   does not execute scripts sees none of it. These tests pin the fix: the same
   words are in the markup, a visitor can actually reach them, and the two
   copies cannot drift apart unnoticed. */

test.describe("the diagnostic reads without JavaScript", () => {
  test("every question in app.js is also in the served HTML", async ({ request }) => {
    /* Fetched, not rendered -- this is the view a crawler that ignores scripts
       gets, which is the whole point of the section. */
    const html = await (await request.get("/index.html")).text();
    const script = await (await request.get("/js/app.js")).text();

    const block = script.match(/const questions = \[(.*?)\n\];/s)[1];
    const questions = [...block.matchAll(/text: "((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
    expect(questions).toHaveLength(8);

    for (const question of questions) {
      /* &amp; and friends are escaped in markup but not in the JS string. */
      const needle = question.replace(/&/g, "&amp;").replace(/\\'/g, "'");
      expect(html, `question missing from HTML: ${question.slice(0, 40)}`).toContain(needle);
    }
  });

  test("every lever's copy is in the served HTML too", async ({ request }) => {
    const html = await (await request.get("/index.html")).text();
    const script = await (await request.get("/js/app.js")).text();

    const block = script.match(/const categoryCopy = \{(.*?)\n\};/s)[1];
    const rows = [...block.matchAll(/\w+: \["((?:[^"\\]|\\.)*)", "((?:[^"\\]|\\.)*)", "((?:[^"\\]|\\.)*)"\]/g)];
    expect(rows).toHaveLength(4);

    for (const [, name, fix, cost] of rows) {
      for (const copy of [name, fix, cost]) {
        const needle = copy.replace(/&/g, "&amp;").replace(/\\'/g, "'");
        expect(html, `lever copy missing: ${copy.slice(0, 40)}`).toContain(needle);
      }
    }
  });

  test("the section is collapsed but reachable, never hidden", async ({ page }) => {
    await loadDiagnostic(page);
    const details = page.locator("#what-it-asks details");
    const summary = details.locator("summary");

    /* Closed by default so the page is not lengthened for someone who does not
       want it -- but present, visible and clickable, which is what separates
       this from the hidden text that gets sites penalised. */
    await expect(summary).toBeVisible();
    expect(await details.evaluate(el => el.open)).toBe(false);
    expect(await details.evaluate(el => getComputedStyle(el).display)).not.toBe("none");
    expect(await details.evaluate(el => getComputedStyle(el).visibility)).not.toBe("hidden");

    await summary.click();
    expect(await details.evaluate(el => el.open)).toBe(true);
    await expect(page.locator("#what-it-asks .preview-q").first()).toBeVisible();
    await expect(page.locator("#what-it-asks .preview-q")).toHaveCount(8);
  });

  test("it opens from the keyboard", async ({ page }) => {
    await loadDiagnostic(page);
    const details = page.locator("#what-it-asks details");
    await details.locator("summary").focus();
    await page.keyboard.press("Enter");
    expect(await details.evaluate(el => el.open)).toBe(true);
  });

  test("the interactive diagnostic is untouched by it", async ({ page }) => {
    await loadDiagnostic(page);
    /* The section is a sibling of the diagnostic, not a part of it: opening it
       must not disturb the question flow the visitor actually answers. */
    await page.locator("#what-it-asks summary").click();
    await expect(page.locator("#questionView")).toBeVisible();
    await expect(page.locator("#options .option").first()).toBeVisible();
    await expect(page.locator("#results")).not.toBeVisible();
  });
});
