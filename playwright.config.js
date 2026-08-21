// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/*
  The pages under test are plain static files, so the "server" is just a static
  file server over public/. Nothing is built, and Playwright never touches the
  pages themselves -- it only drives a browser at them.
*/
module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /* The journey specs run a full eight-question diagnostic each. Too many at once
     and Chromium cannot settle a frame, which surfaces as "element is not stable"
     rather than a real failure -- hence a modest worker count plus one retry. */
  retries: 1,
  /* A full run of the diagnostic is eight animated question transitions plus
     scoring, so the default 30s is tight once several browsers share a laptop. */
  timeout: 60000,
  workers: 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8788",
    trace: "retain-on-failure",
    /* The page honours prefers-reduced-motion, which makes transitions instant
       and scrolling non-smooth. Behaviour is identical and timing stops being a
       variable, so assertions are about the page rather than about animation. */
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      /* iPhone XR's CSS pixel size -- the width the mobile layout was tuned against. */
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 414, height: 896 } },
    },
  ],
  webServer: {
    command: "python3 -m http.server 8788 --directory public",
    url: "http://127.0.0.1:8788/index.html",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    timeout: 30000,
  },
});
