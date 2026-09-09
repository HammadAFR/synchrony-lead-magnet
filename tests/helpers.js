const { expect } = require("@playwright/test");

const PAGE = "/index.html";

/* Known-good figures from computeVacancyCost(), so a change to the formula is
   caught rather than silently absorbed:
     revenueDrag    = (quota / 12) * months * 0.20
     leadershipDrag = hours * 4.33 * months * 200                             */
const VACANCY = {
  standard: { revenue: "2000000", months: "6", hours: "10", total: "$251,960" },
  larger: { revenue: "4000000", months: "5", hours: "12", total: "$385,293" },
};

/**
 * Load the diagnostic.
 *
 * Formspree is intercepted unconditionally: no test may ever reach the real
 * form, both because it would email Michael and because it would burn the
 * monthly submission quota. Anything posted is captured for inspection instead.
 *
 * @returns {Promise<{problems: string[], submissions: object[]}>}
 */
async function loadDiagnostic(page) {
  const problems = [];
  const submissions = [];

  await page.route("**/formspree.io/**", route => {
    try {
      submissions.push(JSON.parse(route.request().postData() || "{}"));
    } catch {
      submissions.push({ unparseable: route.request().postData() });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  /* DNS is stubbed for the same reason Formspree is: no test may depend on the
     network, and none should be answering questions about real domains. The
     default is a domain that takes mail, so the gate behaves as it does for an
     ordinary visitor. email-domain.spec.js registers its own routes on top --
     Playwright matches the most recently added handler first -- to drive the
     cases where the answer is no.

     Worth knowing if a gate test ever fails for no obvious reason: the fixture
     address is dana@example.com, and example.com really does publish a null MX
     declaring it accepts no mail. Without this stub, every submission is
     correctly refused. */
  await page.route("**/dns.google/resolve**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      Status: 0,
      Answer: [{ type: 15, data: "10 mail.example-host.net." }],
    }),
  }));

  /* The Google tag is blocked for the same reason Formspree and DNS are: no
     test may reach a real service. The inline snippet still defines gtag and
     dataLayer, so events are still recorded and assertable -- only the network
     request is stopped. */
  await page.route("**/googletagmanager.com/**", route => route.abort());

  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    /* Google Fonts is a third party and may be unreachable offline; that is not
       a defect in the page. */
    if (message.type() === "error" && !/fonts\.(googleapis|gstatic)\.com/.test(message.text())) {
      problems.push(`console: ${message.text()}`);
    }
  });

  /* Wait for the document, not for `load`: the page pulls fonts from a third
     party, and a slow or unreachable Google Fonts must not stall the suite. */
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1.display")).toBeVisible();
  return { problems, submissions };
}

async function openCalculator(page) {
  await page.locator(".hero-actions .calc-cta-btn").click();
  await expect(page.locator("#costCalcDialog")).toBeVisible();
}

async function fillCalculator(page, values = VACANCY.standard) {
  await page.fill("#costCalcRevenue", values.revenue);
  await page.fill("#costCalcMonths", values.months);
  await page.fill("#costCalcHours", values.hours);
}

/** Run the calculator end to end through the UI, then close the dialog. */
async function getVacancyNumber(page, values = VACANCY.standard) {
  await openCalculator(page);
  await fillCalculator(page, values);
  await expect(page.locator("body")).toHaveAttribute("data-calculator-used", "true");
  await page.locator("#costCalcClose").click();
  await expect(page.locator("#costCalcDialog")).toBeHidden();
}

/**
 * Answer all eight questions, always taking the option at `optionIndex`.
 * Index 0 across the board scores 37/80 -> 46% -> 18/40 -> "Developing".
 */
async function answerAll(page, optionIndex = 0) {
  /* Bring the diagnostic into view first. A real visitor arrives here by
     scrolling or via the calculator's button; doing the same retires Michael's
     card, which is fixed to the corner and otherwise sits over the options. */
  await page.locator("#assessment").scrollIntoViewIfNeeded();
  for (let step = 1; step <= 8; step += 1) {
    await expect(page.locator("#stepLabel")).toHaveText(`Question ${step} of 8`);
    await page.locator("#options .option").nth(optionIndex).click();
    await expect(page.locator("#nextBtn")).toBeEnabled();
    await page.locator("#nextBtn").click();
  }
  await expect(page.locator("#contactGate")).toBeVisible();
}

async function fillGate(page, overrides = {}) {
  const details = {
    firstName: "Dana",
    lastName: "Reyes",
    email: "dana@example.com",
    company: "Acme Industrial",
    optIn: "Yes",
    ...overrides,
  };
  await page.fill("#firstName", details.firstName);
  await page.fill("#lastName", details.lastName);
  await page.fill("#company", details.company);
  await page.fill("#email", details.email);
  /* The radio itself is visually hidden (opacity 0, pointer-events none); the
     label around it is what a visitor actually clicks. */
  await page.locator(`.optin-choice label:has(input[value="${details.optIn}"])`).click();
  await expect(page.locator(`input[name="emailOptIn"][value="${details.optIn}"]`)).toBeChecked();
  return details;
}

/** Scroll the hero fully off screen, which is what lets Michael's card board. */
async function scrollPastHero(page) {
  const heroHeight = await page.locator(".hero").evaluate(el => el.getBoundingClientRect().height);
  await page.evaluate(y => window.scrollTo(0, y), heroHeight + 400);
}

module.exports = {
  PAGE, VACANCY, loadDiagnostic, openCalculator, fillCalculator,
  getVacancyNumber, answerAll, fillGate, scrollPastHero,
};
