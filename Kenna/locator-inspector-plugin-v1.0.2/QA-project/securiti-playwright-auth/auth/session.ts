/**
 * Everything about the saved session: deciding whether to reuse it, warming the
 * origins that need it, and writing it out.
 */

import fs from "fs";
import path from "path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { RunnerConfig } from "./env";
import { isLoginUrl, NotAuthenticatedError } from "./errors";
import { SESSION_COOKIE } from "./login";
import { any, el } from "./locators";

/**
 * Sidecar written next to the state file.
 *
 * `savedAt` exists rather than relying on the state file's mtime because this
 * package ships as a zip, and extraction (or a git checkout) rewrites mtime -
 * which would make a months-old session look freshly minted.
 */
export interface StateMeta {
  email: string;
  loginUrl: string;
  appUrl: string;
  savedAt: number;
  playwright?: string;
}

export interface ReuseVerdict {
  reuse: boolean;
  reason: string;
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

/**
 * Decide whether the session on disk can be reused.
 *
 * Cheap checks first, then a live probe. The probe is what makes this correct
 * rather than merely plausible: this app has an idle-logout plugin, so wall-clock
 * age does not predict validity. An age-only check that guesses wrong produces a
 * failure inside someone's recorded spec - at its first click, with a locator
 * error - which is precisely the failure this package exists to eliminate.
 */
export async function evaluateSavedState(
  browser: Browser,
  config: RunnerConfig,
  email: string,
): Promise<ReuseVerdict> {
  if (config.force) return { reuse: false, reason: "AUTH_FORCE is set" };
  if (!fs.existsSync(config.authFile)) return { reuse: false, reason: "no saved session" };

  const meta = readJson<StateMeta>(config.metaFile);
  if (!meta) return { reuse: false, reason: "no meta sidecar next to the saved session" };
  if (meta.email !== email) {
    return { reuse: false, reason: `the saved session belongs to ${meta.email}` };
  }
  if (meta.appUrl !== config.appUrl || meta.loginUrl !== config.loginUrl) {
    return { reuse: false, reason: "the saved session was created for a different environment" };
  }

  const ageMinutes = Math.round((Date.now() - meta.savedAt) / 60_000);
  if (ageMinutes > config.maxAgeMinutes) {
    return { reuse: false, reason: `the saved session is ${ageMinutes}m old (max ${config.maxAgeMinutes}m)` };
  }

  const state = readJson<{ cookies?: Array<{ name: string; expires?: number }> }>(config.authFile);
  const cookies = state?.cookies;
  if (!cookies?.some((c) => c.name === SESSION_COOKIE)) {
    return { reuse: false, reason: `no ${SESSION_COOKIE} in the saved session` };
  }
  const expiring = cookies.find(
    (c) => typeof c.expires === "number" && c.expires > 0 && c.expires * 1000 < Date.now() + 300_000,
  );
  if (expiring) {
    return { reuse: false, reason: `cookie ${expiring.name} expires within 5 minutes` };
  }

  // Live probe. ~3s, against ~20s for a full login.
  const context = await browser.newContext({
    storageState: config.authFile,
    viewport: config.viewport,
  });
  try {
    const page = await context.newPage();
    await page.goto(config.appUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1_000); // let the SPA bounce us if the session is dead

    if (isLoginUrl(page.url())) {
      return { reuse: false, reason: `the probe was redirected to ${page.url()}` };
    }
    if (await any(el.password(page)).isVisible().catch(() => false)) {
      return { reuse: false, reason: "the probe landed on a login form" };
    }
    return { reuse: true, reason: `valid, ${ageMinutes}m old` };
  } catch (error) {
    const first = String((error as Error).message).split("\n")[0];
    return { reuse: false, reason: `the probe failed: ${first}` };
  } finally {
    await context.close();
  }
}

/**
 * Visit each origin whose localStorage needs to be in the saved session.
 *
 * Session cookies are set on the wildcard domains `.qa.securiti.xyz` and
 * `.securiti.xyz`, so they already cover edc.qa.securiti.xyz. localStorage does
 * not work that way - it is origin-scoped - so an EDC session that depends on
 * origin-local state would break without this step.
 *
 * `storageState()` captures localStorage for *every* origin the context has
 * touched, not just the current page, which is what makes this work.
 */
export async function warmOrigins(
  page: Page,
  urls: string[],
  log: (message: string) => void,
): Promise<void> {
  for (const url of urls) {
    log(`[auth] warming ${url}`);

    // 'load' rather than 'domcontentloaded': an auth handshake can bounce
    // through a redirect chain that domcontentloaded would resolve mid-flight.
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    // Load-bearing: save any earlier and the state has the cookies but an empty
    // origin entry, because the SPA has not written its localStorage yet.
    await page.waitForTimeout(1_500);

    const bounced = isLoginUrl(page.url()) || (await any(el.password(page)).isVisible().catch(() => false));
    if (bounced) {
      throw new NotAuthenticatedError(
        [
          `Login succeeded, but ${url} sent us back to a login screen (now at ${page.url()}).`,
          `  Likely causes: this account has no access to that module or tenant, or`,
          `  AUTH_DOMAIN selected the wrong domain.`,
        ].join("\n"),
        "warm",
        page.url(),
      );
    }
  }
}

export async function saveState(
  context: BrowserContext,
  config: RunnerConfig,
  meta: StateMeta,
): Promise<void> {
  fs.mkdirSync(path.dirname(config.authFile), { recursive: true });
  await context.storageState({ path: config.authFile, indexedDB: config.includeIndexedDB });
  fs.writeFileSync(config.metaFile, `${JSON.stringify(meta, null, 2)}\n`);
}
