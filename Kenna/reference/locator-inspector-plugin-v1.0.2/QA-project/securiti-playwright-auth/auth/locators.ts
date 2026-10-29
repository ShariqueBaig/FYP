/**
 * Login-page locators, as ordered candidate lists.
 *
 * The first entry in each list is the locator the reference implementation uses
 * in production against this exact app, so it is the one we want to win. The
 * rest are fallbacks for markup drift.
 */

import type { Locator, Page } from "@playwright/test";
import { LoginTimeoutError, readVisibleError } from "./errors";

/**
 * Escape a string for use as an XPath literal.
 *
 * The reference implementation interpolates raw text into XPath
 * (`//*[normalize-space(text())='${option}']`), which breaks on any value
 * containing an apostrophe - a real risk for tenant names like "O'Brien Inc".
 */
export function xpathLiteral(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return `concat(${value
    .split("'")
    .map((part) => `'${part}'`)
    .join(`, "'", `)})`;
}

export const el = {
  email: (page: Page): Locator[] => [
    // exact:true matters - getByPlaceholder is substring-matched, so a page with
    // both "Email" and "Email address" would be a strict-mode violation.
    page.getByPlaceholder("Email", { exact: true }),
    page.locator('form#fndri-login-form input[type="email"]'),
    page.locator('input[type="email"]'),
    page.locator("input#email"),
    page.getByPlaceholder(/e-?mail/i),
    page.getByLabel(/^e-?mail/i),
  ],

  password: (page: Page): Locator[] => [
    page.getByPlaceholder("Password", { exact: true }),
    page.locator('input[type="password"]'),
    page.getByLabel(/^password$/i),
  ],

  /**
   * The same button element serves as both "Continue" (step 1) and "Sign in"
   * (step 2) in this app - it is bound to the form by id.
   */
  submit: (page: Page): Locator[] => [
    page.locator("button[form='fndri-login-form']"),
    page.locator('form#fndri-login-form button[type="submit"]'),
    page.getByRole("button", { name: /^\s*(continue|next|sign\s*in|log\s*in|submit)\s*$/i }),
    // The reference XPath. Case-sensitive, hence the regex above it - the
    // reference itself carries both "Sign in" and "Sign In" constants.
    page.locator(
      '//*[normalize-space(text())="Sign in" or normalize-space(text())="Sign In"]/ancestor::button',
    ),
  ],

  domainSelect: (page: Page): Locator[] => [
    page.locator(".v-select").filter({ has: page.getByLabel("Select Domain") }),
    page.locator(".v-select").filter({ hasText: /select\s+domain/i }),
    page.getByLabel(/select\s+domain/i),
    page.locator(".v-select").first(),
  ],

  domainOption: (page: Page, domain: string): Locator[] => [
    page.locator(`//*[normalize-space(text())=${xpathLiteral(domain)}]/ancestor::a`),
    page.getByRole("option", { name: domain, exact: true }),
    page.locator(".menuable__content__active").getByText(domain, { exact: true }),
    page.locator(".v-list-item").filter({ hasText: domain }),
  ],
};

/** Union of candidates, as a single locator. Resolves to whichever appears first in the DOM. */
export function any(candidates: Locator[]): Locator {
  return candidates.reduce((a, b) => a.or(b)).first();
}

/**
 * Wait for any candidate to appear, then return the highest-priority one that is
 * actually visible.
 *
 * This exists because `a.or(b).first()` resolves by DOM order, not by candidate
 * order - so using it directly would silently discard the "prefer the proven
 * locator" intent of the lists above.
 */
export async function pickVisible(
  page: Page,
  what: string,
  candidates: Locator[],
  timeout: number,
): Promise<Locator> {
  try {
    await any(candidates).waitFor({ state: "visible", timeout });
  } catch {
    const message = await readVisibleError(page);
    throw new LoginTimeoutError(
      [
        `Could not find the ${what} within ${timeout}ms.`,
        `  URL: ${page.url()}`,
        ...(message ? [`  The page said: "${message}"`] : []),
      ].join("\n"),
      what,
      page.url(),
    );
  }

  for (const candidate of candidates) {
    const first = candidate.first();
    if (await first.isVisible().catch(() => false)) return first;
  }

  // The element appeared and then went away between the wait and the loop.
  // The union is still a correct locator, so hand that back.
  return any(candidates);
}
