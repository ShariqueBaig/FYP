import { defineConfig } from "@playwright/test";
import { readRunnerConfig } from "./auth/env";

// Loads `.env` as a side effect. Never throws - missing credentials surface as a
// test failure inside the `auth` project, not as a stack trace at config load.
const config = readRunnerConfig();

export default defineConfig({
  testDir: "./tests",

  // Not the reference project's `fullyParallel: true` / `workers: 5`. Every worker
  // shares the one saved session, and recorded specs create named entities - so a
  // second worker filling the same name trips a duplicate-name validation, which
  // presents as a "broken" button rather than as a collision.
  fullyParallel: false,
  workers: config.workers,
  retries: config.retries,
  forbidOnly: !!process.env.CI,

  // Not the reference's 1_800_000. A 30-minute test timeout would hang the
  // generator's run loop on any genuine failure.
  timeout: config.testTimeout,
  expect: { timeout: config.expectTimeout },

  // `open: 'never'` so a shell-out from the generator can never block waiting for
  // someone to close a report tab.
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    // Absolute URLs in page.goto() always win, so this cannot affect recorded
    // specs. It exists for the warm-up and smoke code, and for any future relative
    // navigation. Note: toHaveURL() with a *string* is resolved against baseURL,
    // while a regex is matched against the full URL and ignores it.
    baseURL: config.appUrl,

    headless: config.headless,

    // Deliberately NOT the reference's `viewport: null` + `--start-maximized`.
    // In headless Chromium that flag is a no-op and a null viewport yields roughly
    // 800x600, which pushes this responsive app into its compact layout - toolbars
    // collapse into overflow menus and recorded locators such as
    // getByRole('button', { name: 'Add' }) genuinely stop existing.
    viewport: config.viewport,

    actionTimeout: config.actionTimeout,
    navigationTimeout: config.navigationTimeout,
    timezoneId: config.timezoneId,

    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "auth",
      testMatch: /auth\.setup\.ts$/,
      use: {
        // The login flow is proven on webkit in the reference implementation.
        // storageState is engine-portable JSON, so a webkit login feeds a chromium
        // run if chromium ever struggles with the form.
        browserName: config.authBrowser,

        // Explicit, and load-bearing. If storageState were set at the top level
        // this project would inherit it and fail with ENOENT on the very first
        // run - before the login that creates the file could happen.
        storageState: undefined,

        // A login trace captures the form and the Set-Cookie headers.
        trace: "off",
        video: "off",
      },
    },
    {
      // Named `chromium` so a habitual `--project=chromium` just works.
      name: "chromium",
      testMatch: /.*\.spec\.ts$/,
      testIgnore: "**/examples/**",
      dependencies: ["auth"],
      use: {
        browserName: "chromium",
        storageState: config.authFile,
      },
    },
    {
      // Opt-in: the example recording creates real data. Excluded from `npm test`
      // via the script's --project flag rather than via config.
      name: "examples",
      testDir: "./tests/examples",
      dependencies: ["auth"],
      use: {
        browserName: "chromium",
        storageState: config.authFile,
      },
    },
  ],
});
