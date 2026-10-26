/**
 * The `auth` setup project.
 *
 * Runs before every other project (they declare `dependencies: ['auth']`), and
 * leaves a valid session at `.auth/user.json`. Recorded specs need no auth code
 * of their own as a result.
 *
 * This file must live inside `testDir` - `testMatch` only searches there, and a
 * root-level setup file would silently never be discovered.
 */

import path from "path";
import { test as setup } from "@playwright/test";
import { looksLikeQaOrDev, PACKAGE_ROOT, readCredentials, readRunnerConfig } from "../auth/env";
import { login } from "../auth/login";
import { evaluateSavedState, saveState, warmOrigins } from "../auth/session";

const config = readRunnerConfig();

setup("authenticate", async ({ browser, page }) => {
  setup.setTimeout(config.loginTimeout + 120_000);

  const log = (message: string) => console.log(message);
  const relative = (file: string) => path.relative(PACKAGE_ROOT, file);

  // Throws a report-friendly error naming the missing key if .env is incomplete.
  const credentials = readCredentials();

  const verdict = await evaluateSavedState(browser, config, credentials.email);
  if (verdict.reuse) {
    // skip(), not return: dependent projects block on *failure* only, so a skip
    // lets them proceed against the session we just verified. This is what keeps
    // `--ui` mode usable - a ~3s probe rather than a ~20s login on every re-run.
    setup.skip(true, `Reusing ${relative(config.authFile)} (${verdict.reason})`);
  }

  log(`[auth] fresh login required: ${verdict.reason}`);
  log(
    `[auth] email from ${credentials.sources.AUTH_EMAIL}, ` +
      `password from ${credentials.sources.AUTH_PASSWORD}`,
  );

  if (!credentials.mfaCode && looksLikeQaOrDev(config.loginUrl)) {
    log(
      `[auth] WARNING: ${config.loginUrl} looks like a qa/dev host but AUTH_MFA_CODE is empty.\n` +
        `[auth]          These environments normally require a 6-digit code appended to the\n` +
        `[auth]          password. Expect the login to be rejected.`,
    );
  }

  await login(page, {
    loginUrl: config.loginUrl,
    email: credentials.email,
    password: credentials.password,
    mfaCode: credentials.mfaCode,
    domain: credentials.domain,
    timeout: config.loginTimeout,
    log,
  });

  await warmOrigins(page, config.warmUrls, log);

  await saveState(page.context(), config, {
    email: credentials.email,
    loginUrl: config.loginUrl,
    appUrl: config.appUrl,
    savedAt: Date.now(),
    playwright: playwrightVersion(),
  });

  log(`[auth] saved session -> ${relative(config.authFile)}`);
});

function playwrightVersion(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@playwright/test/package.json").version as string;
  } catch {
    return undefined;
  }
}
