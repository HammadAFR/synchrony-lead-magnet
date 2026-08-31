const { test, expect } = require("@playwright/test");
const { loadDiagnostic, getVacancyNumber, answerAll, fillGate, VACANCY } = require("./helpers");

/* Public DNS is stubbed throughout. These tests are about what the page does
   with each answer -- and above all that a domain lookup, however it goes,
   never costs someone their diagnostic. */

const DNS = "**/dns.google/resolve**";

/* Shapes copied from real answers: an MX record is type 15, an address record
   type 1, and Status 3 is NXDOMAIN. "0 ." is a domain declaring it takes no
   mail at all, which a naive length check reads as a working mailbox. */
const REPLIES = {
  mx: { Status: 0, Answer: [{ type: 15, data: "0 acme-com.mail.protection.outlook.com." }] },
  nxdomain: { Status: 3, Answer: [] },
  nullMx: { Status: 0, Answer: [{ type: 15, data: "0 ." }] },
  noMxButAddressed: { Status: 0, Answer: [{ type: 1, data: "203.0.113.10" }] },
  empty: { Status: 0, Answer: [] },
};

/** Route DNS by record type: `{ MX: reply, A: reply }`. */
async function stubDns(page, byType) {
  const asked = [];
  await page.route(DNS, route => {
    const url = new URL(route.request().url());
    const type = url.searchParams.get("type") === "15" ? "MX" : "A";
    asked.push({ name: url.searchParams.get("name"), type });
    const reply = byType[type];
    if (reply === "offline") return route.abort("failed");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply || REPLIES.empty) });
  });
  return asked;
}

async function submitGate(page, email) {
  await getVacancyNumber(page, VACANCY.larger);
  await answerAll(page);
  await fillGate(page, { email });
  await page.locator("#contactGate button[type=submit]").click();
}

test.describe("work email domain check", () => {
  test("a real mail domain goes straight through", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    const asked = await stubDns(page, { MX: REPLIES.mx });

    await submitGate(page, "ceo@acme.com");
    await expect(page.locator("#results")).toBeVisible();
    await expect.poll(() => submissions.length).toBe(1);
    expect(asked[0]).toEqual({ name: "acme.com", type: "MX" });
    /* One usable MX answers the question; the address record is not needed. */
    expect(asked.filter(query => query.type === "A")).toEqual([]);
  });

  test("an invented domain is caught before anything is sent", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    await stubDns(page, { MX: REPLIES.nxdomain, A: REPLIES.nxdomain });

    await submitGate(page, "ceo@asdfqwerzxcv12345.com");

    await expect(page.locator("#emailError")).toContainText("cannot find a domain called asdfqwerzxcv12345.com");
    await expect(page.locator("#email")).toHaveClass(/is-invalid/);
    /* Still on the form, with the results and the lead both withheld. */
    await expect(page.locator("#contactGate")).toBeVisible();
    await expect(page.locator("#results")).not.toBeVisible();
    expect(submissions).toEqual([]);
  });

  test("correcting the address gets them through", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    await page.route(DNS, route => {
      const name = new URL(route.request().url()).searchParams.get("name");
      const reply = name === "acme.com" ? REPLIES.mx : REPLIES.nxdomain;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
    });

    await submitGate(page, "ceo@acme.cm");
    await expect(page.locator("#emailError")).toContainText("acme.cm");

    await page.fill("#email", "ceo@acme.com");
    await page.locator("#email").blur();
    await page.locator("#contactGate button[type=submit]").click();

    await expect(page.locator("#results")).toBeVisible();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0]["Work Email"]).toBe("ceo@acme.com");
  });

  test("a domain that declares it takes no mail is refused", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    /* Null MX with an address record present: the fallback must not rescue it. */
    await stubDns(page, { MX: REPLIES.nullMx, A: REPLIES.noMxButAddressed });

    await submitGate(page, "ceo@example.com");
    await expect(page.locator("#emailError")).toContainText("not set up to receive email");
    expect(submissions).toEqual([]);
  });

  test("no MX but a real address record is accepted", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    /* Small company domains often run mail straight off the A record. */
    await stubDns(page, { MX: REPLIES.empty, A: REPLIES.noMxButAddressed });

    await submitGate(page, "owner@smallfirm.com");
    await expect(page.locator("#results")).toBeVisible();
    await expect.poll(() => submissions.length).toBe(1);
  });

  test("unreachable DNS lets the address through", async ({ page }) => {
    const { submissions } = await loadDiagnostic(page);
    await stubDns(page, { MX: "offline", A: "offline" });

    await submitGate(page, "ceo@acme.com");
    /* Failing open is the point: a lookup that cannot run must never be the
       reason a real prospect loses their results. */
    await expect(page.locator("#results")).toBeVisible();
    await expect.poll(() => submissions.length).toBe(1);
  });

  test("a consumer address is still refused without asking DNS", async ({ page }) => {
    await loadDiagnostic(page);
    const asked = await stubDns(page, { MX: REPLIES.mx });

    await getVacancyNumber(page, VACANCY.larger);
    await answerAll(page);
    await fillGate(page, { email: "someone@gmail.com" });
    await page.locator("#email").blur();

    await expect(page.locator("#emailError")).toContainText("work email");
    /* gmail.com resolves perfectly well -- the question never needed asking. */
    expect(asked).toEqual([]);
  });

  test("the same domain is only looked up once", async ({ page }) => {
    await loadDiagnostic(page);
    const asked = await stubDns(page, { MX: REPLIES.mx });

    await getVacancyNumber(page, VACANCY.larger);
    await answerAll(page);
    await fillGate(page, { email: "first@acme.com" });
    await page.locator("#email").blur();
    await expect.poll(() => asked.length).toBe(1);

    await page.fill("#email", "second@acme.com");
    await page.locator("#email").blur();
    await page.locator("#contactGate button[type=submit]").click();
    await expect(page.locator("#results")).toBeVisible();
    expect(asked).toHaveLength(1);
  });
});
