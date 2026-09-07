# The Empty Seat Diagnostic

An interactive lead magnet for [Synchrony Talent Partners](https://synchronytalent.com/).
A visitor prices their open sales-leadership seat, answers eight questions about how
they hire, and gets a scored readout plus a Hiring Clarity Blueprint on the spot.

The funnel: **Vacancy Cost Calculator → 8-question diagnostic → results and score →
Hiring Clarity Blueprint → book a clarity session.**

## Layout

```
public/                     everything that gets deployed
├── index.html              the diagnostic: markup only
├── vacancy-cost-calculator/
│   └── index.html          the calculator on its own URL, for linking and indexing
├── css/styles.css          all styles, both pages
├── js/vacancy-cost.js      the cost formula, shared by both pages
├── js/app.js               diagnostic, results, blueprint, the calculator dialog
├── js/calculator-page.js   wiring for the standalone calculator only
├── js/scroll-prompt.js     Michael's floating nudge
├── robots.txt
├── sitemap.xml
└── assets/
    ├── fonts/              self-hosted DM Sans and DM Serif Display
    ├── images/
    └── audio/
tests/                      Playwright browser tests
archive/                    retired pages, kept for reference; not deployed
```

## No build step

The page is plain HTML, CSS and JavaScript. There is nothing to compile, bundle or
transpile — the browser loads exactly the files in `public/`, and deploying is a
file copy.

`package.json` and `node_modules/` exist **only** for the test tooling. Nothing
there reaches a visitor. If the tooling ever goes stale the site keeps working; you
just lose the tests.

The scripts are classic scripts rather than ES modules, so top-level declarations stay
reachable from the markup's inline handlers and across files. That is also how the two
pages share code: `js/vacancy-cost.js` declares the cost formula and the sessionStorage
handoff at top level, and both `js/app.js` and `js/calculator-page.js` use them as
globals. It must be loaded first on either page. `js/app.js` loads before
Michael's card exists in the document, which is why `js/scroll-prompt.js` is separate
rather than merged into it. The theme script stays inline in `<head>`: moving it to a
file would fetch it after first paint and bring back a flash of the wrong theme.

## Running it locally

```bash
npm install            # first time only
npx playwright install chromium
npm run serve          # http://127.0.0.1:8788
```

## Tests

```bash
npm test               # all of it, both viewports
npm run test:headed    # watch it happen in a real window
npm run test:ui        # pick and step through individual tests
npm run test:report    # open the last HTML report
```

Coverage: page loads and layout, calculator arithmetic and its lock, the diagnostic
from first question to scored results, the Formspree payload, Michael's card, and the
headline copy and metadata.

**Formspree is intercepted in every test.** No test run can reach the live form, email
anyone, or spend the monthly submission quota.

## Email delivery

Completed diagnostics are posted to Formspree, which emails them onward. Two settings,
both at the top of `js/app.js`:

| Setting | Purpose |
|---|---|
| `EMAIL_DELIVERY_ENABLED` | Master on/off. Set `false` locally so test runs never reach a real inbox. |
| `EMAIL_ENDPOINT` | The Formspree form URL. |

Which inbox receives the mail, spam filtering and allowed domains are all configured on
formspree.io against that form, not here. Never put a private API key in these files —
they ship to the browser.

## Deploying

```bash
firebase deploy --only hosting
```

`firebase.json` publishes `public/`. `tests/`, `archive/`, `node_modules/` and the
tooling all sit outside it and are never uploaded.

## Changing the domain

Several absolute URLs in `<head>` name the live host, on **both pages**: the canonical
link, `og:url`, `og:image` and `twitter:image` sit together under one comment block, the
JSON-LD carries `@id` and `url` values, and the redirect in the inline theme script names
it once more. `public/sitemap.xml` and `public/robots.txt` name it too. Update them
together when the domain changes, or shared links and structured data keep pointing at
the old host. Grep for the host rather than counting them by hand:

```bash
grep -rn emptyseatdiagnostic.com public/
```
