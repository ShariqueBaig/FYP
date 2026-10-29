/**
 * Named failure modes, plus the two helpers that make login failures readable.
 *
 * The whole point of this file: a login that fails should say "the app rejected
 * these credentials" and quote the app's own words, not "Timeout 60000ms
 * exceeded waiting for locator". The difference decides whether someone debugs
 * their `.env` or their recorder.
 */

import type { Page } from "@playwright/test";

export class LoginError extends Error {
  constructor(
    message: string,
    readonly stage: string,
    readonly url?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The app said no: bad password, bad MFA code, locked or disabled account. */
export class LoginRejectedError extends LoginError {}

/** No verdict either way within the timeout. */
export class LoginTimeoutError extends LoginError {}

/** A "Select Domain" step appeared but AUTH_DOMAIN was not set. */
export class DomainRequiredError extends LoginError {}

/** We left the login form, but no session cookie exists - storageState would be useless. */
export class NoSessionCookieError extends LoginError {}

/** Login worked, but a warmed origin or a probed session bounced back to a login screen. */
export class NotAuthenticatedError extends LoginError {}

// -------------------------------------------------------------------------- //
// Reading the app's own error messages
// -------------------------------------------------------------------------- //

/**
 * Where this Vuetify app puts its errors. The first two are lifted from the
 * reference implementation's BasePage; the rest are generic fallbacks.
 */
const ERROR_SELECTORS = [
  ".toasted",
  ".error--text .v-messages__message",
  ".v-messages__message.error--text",
  ".v-alert__content",
  '[role="alert"]',
];

const REJECTION =
  /invalid|incorrect|wrong|failed|not\s+authoriz|unauthori|expired|locked|disabled|denied|unable|does\s+not\s+exist|no\s+such/i;

/** The first visible error message on the page, normalised, or undefined. */
export async function readVisibleError(page: Page): Promise<string | undefined> {
  for (const selector of ERROR_SELECTORS) {
    const locator = page.locator(selector);

    const total = await locator.count().catch(() => 0);
    const limit = Math.min(total, 5);

    for (let i = 0; i < limit; i++) {
      const element = locator.nth(i);
      if (!(await element.isVisible().catch(() => false))) continue;

      const text = (await element.innerText().catch(() => ""))
        // Vuetify renders icons as ligature text, which lands in innerText.
        .replace(/\b(close_small|close|error_outline|warning)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (text) return text.slice(0, 300);
    }
  }
  return undefined;
}

/** Whether a scraped message reads as a rejection rather than an incidental notice. */
export function looksLikeRejection(text?: string): boolean {
  return !!text && REJECTION.test(text);
}

// -------------------------------------------------------------------------- //
// Recognising a login URL
// -------------------------------------------------------------------------- //

const LOGIN_PATH = /(?:^|[/#])(login|signin|sign-in|sso|auth)(?:[/?#]|$)/i;

/**
 * Whether a URL is a login screen.
 *
 * Checks the hash as well as the path, because this app is hash-routed and its
 * login lives at `https://qa.securiti.xyz/#/login`. Used as a *secondary*
 * signal only - see the note in login.ts on why the reference implementation's
 * URL-only predicate is unsafe.
 */
export function isLoginUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return LOGIN_PATH.test(parsed.pathname) || LOGIN_PATH.test(parsed.hash);
  } catch {
    return /login/i.test(url);
  }
}
