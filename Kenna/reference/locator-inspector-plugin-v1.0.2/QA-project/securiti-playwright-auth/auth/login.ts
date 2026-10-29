/**
 * The login routine. This is the only file that knows how the Securiti login
 * form works; everything else treats it as a black box.
 *
 * The flow is a two-step form:
 *
 *     goto  ->  email  ->  Continue  ->  [optional "Select Domain"]  ->  password  ->  Sign in
 *
 * The MFA code is *appended to the password* rather than typed into a separate
 * field. There is no OTP screen. qa and dev environments require it.
 */

import { expect, type Page } from "@playwright/test";
import {
  DomainRequiredError,
  isLoginUrl,
  LoginError,
  LoginRejectedError,
  LoginTimeoutError,
  NoSessionCookieError,
  looksLikeRejection,
  readVisibleError,
} from "./errors";
import { any, el, pickVisible } from "./locators";

/** The cookie that actually represents an authenticated session. */
export const SESSION_COOKIE = "FNDRSESSIONID";

export interface LoginOptions {
  loginUrl: string;
  email: string;
  password: string;
  /** Appended directly to the password when present. */
  mfaCode?: string;
  /** Only consumed if the "Select Domain" step appears. */
  domain?: string;
  timeout?: number;
  log?: (message: string) => void;
}

export async function login(page: Page, options: LoginOptions): Promise<void> {
  const timeout = options.timeout ?? 90_000;
  const log = options.log ?? (() => {});

  log(`[auth] logging in as ${options.email} at ${options.loginUrl}`);
  log(`[auth] MFA suffix: ${options.mfaCode ? "set" : "NOT set"}`);

  await page.goto(options.loginUrl, { waitUntil: "domcontentloaded", timeout });

  // --- step 1: email ------------------------------------------------------ //
  const email = await pickVisible(page, "email field", el.email(page), timeout);
  await email.fill(options.email);
  // Vuetify inputs are v-model bound and occasionally re-render mid-fill.
  await expect(email).toHaveValue(options.email, { timeout: 5_000 });

  const continueButton = await pickVisible(page, "Continue button", el.submit(page), timeout);
  await expect(continueButton).toBeEnabled({ timeout: 10_000 });
  await continueButton.click();

  // --- step 2: the domain step, which only some accounts see -------------- //
  await selectDomainIfPresent(page, options, timeout, log);

  // --- step 3: password (+ MFA suffix) ------------------------------------ //
  const password = await pickVisible(page, "password field", el.password(page), timeout);
  const secret = options.password + (options.mfaCode ?? "");
  await password.fill(secret);

  // Never assert toHaveValue on the password: the assertion message would print
  // it into the HTML report and the trace. Compare lengths instead.
  const accepted = await password.inputValue();
  if (accepted.length !== secret.length) {
    throw new LoginError(
      `The password field accepted ${accepted.length} of ${secret.length} characters ` +
        `(a Vuetify re-render probably interrupted the fill).`,
      "password",
      page.url(),
    );
  }

  const urlBeforeSubmit = page.url();
  const signIn = await pickVisible(page, "Sign in button", el.submit(page), timeout);
  await signIn.click();

  await waitForLoginOutcome(page, {
    timeout,
    urlBeforeSubmit,
    hasMfa: !!options.mfaCode,
  });

  log(`[auth] authenticated, now at ${page.url()}`);
}

/**
 * Accounts whose email maps to multiple tenants get a "Select Domain" dropdown
 * between the email and password steps; others go straight to the password.
 * We race the two, exactly as the reference does.
 */
async function selectDomainIfPresent(
  page: Page,
  options: LoginOptions,
  timeout: number,
  log: (message: string) => void,
): Promise<void> {
  const dropdown = any(el.domainSelect(page));
  const password = any(el.password(page));

  try {
    await dropdown.or(password).first().waitFor({ state: "visible", timeout });
  } catch {
    const message = await readVisibleError(page);
    throw new LoginRejectedError(
      [
        `After submitting the email, neither the "Select Domain" dropdown nor the`,
        `password field appeared within ${timeout}ms.`,
        `  URL: ${page.url()}`,
        message
          ? `  The page said: "${message}"`
          : `  No error was visible. AUTH_EMAIL may not be a known account on this environment.`,
      ].join("\n"),
      "email-step",
      page.url(),
    );
  }

  if (!(await dropdown.isVisible().catch(() => false))) return; // no domain step for this account

  if (!options.domain) {
    throw new DomainRequiredError(
      [
        `This account requires a domain: a "Select Domain" step appeared after the email.`,
        `  Set AUTH_DOMAIN=<domain> in .env and run again.`,
        `  The value is the tenant label shown in that dropdown, e.g. "Acme (acme.example)".`,
      ].join("\n"),
      "domain",
      page.url(),
    );
  }

  log(`[auth] domain step present, selecting "${options.domain}"`);
  await dropdown.click();

  const option = await pickVisible(
    page,
    `domain option "${options.domain}"`,
    el.domainOption(page, options.domain),
    20_000,
  );
  await option.click();

  // Some variants of this form need Continue pressed again after the domain pick.
  if (!(await password.isVisible().catch(() => false))) {
    const again = page.locator("button[form='fndri-login-form']");
    if (await again.first().isVisible().catch(() => false)) await again.first().click();
  }

  await expect(password).toBeVisible({ timeout });
}

/**
 * Decide whether the login actually succeeded.
 *
 * Do NOT replace this with the reference implementation's
 * `waitForURL(u => !u.href.includes('/login'))`. That predicate resolves
 * *immediately* whenever the login form is rendered at `#/` rather than
 * `#/login` - so storageState gets written before any session exists, and every
 * generated spec then fails at its first click with a completely misleading
 * locator timeout.
 *
 * Two phases instead:
 *   1. the login form must go away (and we must not be on a login URL)
 *   2. a session cookie must exist, so there is something worth saving
 */
async function waitForLoginOutcome(
  page: Page,
  args: { timeout: number; urlBeforeSubmit: string; hasMfa: boolean },
): Promise<void> {
  const context = page.context();
  const password = any(el.password(page));
  const deadline = Date.now() + args.timeout;

  let lastMessage: string | undefined;
  let succeeded = false;

  // Phase 1. Polling only starts after the submit click, so - unlike a URL
  // predicate evaluated up front - this cannot resolve spuriously at t=0.
  while (Date.now() < deadline) {
    if (page.isClosed()) throw new LoginError("The page closed during login.", "submit");

    const formGone = !(await password.isVisible().catch(() => false));
    if (formGone && !isLoginUrl(page.url())) {
      succeeded = true;
      break;
    }

    const message = await readVisibleError(page);
    if (looksLikeRejection(message)) {
      throw new LoginRejectedError(
        `The app rejected the login: "${message}"${mfaHint(args.hasMfa)}`,
        "submit",
        page.url(),
      );
    }
    lastMessage = message ?? lastMessage;

    await page.waitForTimeout(300);
  }

  if (!succeeded) {
    const formVisible = await password.isVisible().catch(() => false);
    throw new LoginTimeoutError(
      [
        `Login did not complete within ${args.timeout}ms.`,
        `  URL before submit: ${args.urlBeforeSubmit}`,
        `  URL now:           ${page.url()}`,
        `  login form still visible: ${formVisible}`,
        ...(lastMessage ? [`  last visible message: "${lastMessage}"`] : []),
        mfaHint(args.hasMfa),
      ].join("\n"),
      "submit",
      page.url(),
    );
  }

  // Phase 2. Confirm there is a session to save.
  //
  // This is the confirmation gate, not the primary one, on purpose: `_xsrf` is
  // set pre-authentication, and we cannot prove FNDRSESSIONID is never set for
  // an anonymous session. Treating it as confirmation is strictly safe; treating
  // it as the primary signal would risk failing a login that actually worked.
  const hasSession = await pollFor(async () => {
    const cookies = await context.cookies();
    return cookies.some((c) => c.name === SESSION_COOKIE && c.value.length > 0);
  }, 15_000);

  if (!hasSession) {
    throw new NoSessionCookieError(
      [
        `Left the login form (now at ${page.url()}) but no ${SESSION_COOKIE} cookie was set,`,
        `so the saved session would be useless.`,
        `  Look for an interstitial the routine did not handle: an MFA prompt, a consent`,
        `  screen, a tenant picker, or a "session already active" dialog.`,
      ].join("\n"),
      "session",
      page.url(),
    );
  }

  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

function mfaHint(hasMfa: boolean): string {
  return hasMfa
    ? `\n  Hint: AUTH_MFA_CODE is set and was appended to the password. If the code has changed, update .env.`
    : `\n  Hint: AUTH_MFA_CODE is NOT set. qa and dev environments require a 6-digit code appended to the password.`;
}

async function pollFor(predicate: () => Promise<boolean>, timeout: number): Promise<boolean> {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await predicate().catch(() => false)) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
