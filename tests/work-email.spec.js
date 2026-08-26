const { test, expect } = require("@playwright/test");
const { loadDiagnostic, getVacancyNumber, answerAll, fillGate } = require("./helpers");

/** Reach the contact gate with everything filled except the email. */
async function atGate(page) {
  const state = await loadDiagnostic(page);
  await getVacancyNumber(page);
  await answerAll(page);
  await fillGate(page);
  return state;
}

const submit = page => page.locator("#contactGate button[type=submit]").click();
const error = page => page.locator("#emailError");

test.describe("work email only", () => {
  test("a consumer address is refused, with a reason", async ({ page }) => {
    const { submissions } = await atGate(page);
    await page.fill("#email", "michael@gmail.com");
    await expect(error(page)).toContainText("Please use your work email");
    await expect(error(page)).toContainText("gmail.com");
    await expect(page.locator("#email")).toHaveClass(/is-invalid/);

    await submit(page);
    /* Blocked by constraint validation, so nothing scores and nothing is sent. */
    await expect(page.locator("#results")).not.toHaveClass(/show/);
    expect(submissions).toEqual([]);
  });

  test("country editions are caught too", async ({ page }) => {
    await atGate(page);
    for (const address of ["dana@yahoo.co.uk", "dana@hotmail.fr", "dana@live.com.au"]) {
      await page.fill("#email", address);
      await expect(error(page), address).toContainText("Please use your work email");
    }
  });

  test("a company address goes straight through", async ({ page }) => {
    const { submissions } = await atGate(page);
    await page.fill("#email", "dana@acme-industrial.com");
    await expect(error(page)).toHaveText("");
    await expect(page.locator("#email")).not.toHaveClass(/is-invalid/);

    await submit(page);
    await expect(page.locator("#results")).toHaveClass(/show/);
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0]["Work Email"]).toBe("dana@acme-industrial.com");
  });

  test("correcting the address clears the block", async ({ page }) => {
    const { submissions } = await atGate(page);
    await page.fill("#email", "dana@outlook.com");
    await expect(error(page)).not.toHaveText("");
    await page.fill("#email", "dana@acme.co");
    await expect(error(page)).toHaveText("");

    await submit(page);
    await expect(page.locator("#results")).toHaveClass(/show/);
    await expect.poll(() => submissions.length).toBe(1);
  });

  test("an unfamiliar domain is let through rather than guessed at", async ({ page }) => {
    await atGate(page);
    /* The list can never be complete, so the failure mode is deliberate:
       err towards admitting a real customer, not towards blocking one. */
    for (const address of ["dana@some-tiny-firm.io", "dana@acme.gmail-partners.com"]) {
      await page.fill("#email", address);
      await expect(error(page), address).toHaveText("");
    }
  });
});
