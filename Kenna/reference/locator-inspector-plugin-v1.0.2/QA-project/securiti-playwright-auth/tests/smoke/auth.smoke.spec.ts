/**
 * Proof that the saved session actually authenticates against the app the
 * recorded specs target. Read-only - it navigates and asserts, nothing else -
 * so it is safe to run on every invocation.
 *
 * If this passes and a recorded spec still hits the login wall, the problem is
 * in the spec or its locators, not in auth. That is the whole value of having it.
 */

import { expect, test } from "@playwright/test";
import { readRunnerConfig } from "../../auth/env";
import { isLoginUrl } from "../../auth/errors";
import { SESSION_COOKIE } from "../../auth/login";

const config = readRunnerConfig();

test("the saved session authenticates against the app", async ({ page, context }) => {
  await page.goto(config.appUrl, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});

  // Settle before asserting. A negative URL assertion would otherwise pass in the
  // instant before the SPA redirects an unauthenticated visitor to the login page.
  await page.waitForTimeout(1_500);

  expect
    .soft(isLoginUrl(page.url()), `expected to be inside the app, but landed on ${page.url()}`)
    .toBe(false);

  await expect
    .soft(page.locator('input[type="password"]'), "a password field is visible - not authenticated")
    .toHaveCount(0);

  const cookies = await context.cookies();
  expect(cookies.map((c) => c.name)).toContain(SESSION_COOKIE);
});
