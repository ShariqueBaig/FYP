# securiti-playwright-auth

Logs into the Securiti app once, saves the session, and hands it to every test — so a recorded
Playwright script runs **exactly as your generator emitted it**, with no login code bolted on.

A recording that starts like this:

```ts
test('TODO rename: button Create', async ({ page }) => {
  // Step 1: open the application
  await page.goto('https://edc.qa.securiti.xyz/');
  // Step 2: Click span "Glossary Terms"
  await page.getByText('Glossary Terms', { exact: true }).click();
```

…lands on step 2 already authenticated. No import, no fixture, no edit.

## Quickstart

```bash
npm ci
npm run browsers                # installs the chromium binary
cp .env.example .env            # then fill in three values, below
npm run login                   # logs in; watch it happen
npm test                        # proves the session works
```

The three values you must fill in `.env`:

```bash
AUTH_EMAIL=you@yourdomain.com
AUTH_PASSWORD=...
AUTH_MFA_CODE=......            # 6 digits, REQUIRED on qa/dev — see below
```

**About `AUTH_MFA_CODE`:** on qa and dev environments this app expects a 6-digit code **appended
directly to the password** — `password` + `code` typed into the password box. There is no separate OTP
screen. Ask the automation team for the current value; it is deliberately not committed anywhere in
this package. Leave it blank on prod.

## How it works

```
┌─ project: auth ──────────────────────────────────────────────────┐
│  tests/auth.setup.ts                                             │
│    1. is .auth/user.json still good?  (age + a live probe)        │
│         yes -> skip, reuse it                                    │
│    2. login()      email -> Continue -> [domain] -> password      │
│    3. warmOrigins()  visit APP_URL so its localStorage is saved   │
│    4. saveState()  -> .auth/user.json + .auth/user.meta.json      │
└──────────────────────────────┬───────────────────────────────────┘
                               │ dependencies: ['auth']
┌──────────────────────────────▼───────────────────────────────────┐
│  project: chromium    use: { storageState: '.auth/user.json' }    │
│    tests/generated/*.spec.ts   <- your recordings go here         │
│    tests/smoke/*.spec.ts                                          │
└──────────────────────────────────────────────────────────────────┘
```

The `auth` project runs automatically — for a plain `playwright test`, for a single-file run, and in
`--ui` mode. You never have to remember to log in first.

**Session reuse is validated, not assumed.** Before reusing a saved session it checks the age, the
environment it was saved for, the presence and expiry of the session cookie, *and* loads `APP_URL` in a
throwaway context to confirm it isn't bounced to a login screen. That probe costs ~3s against ~20s for
a full login. It exists because this app has an idle-logout plugin, so wall-clock age doesn't predict
validity — and a session that's silently dead produces a locator failure inside your recording, which
is the one outcome this package exists to prevent.

## What's in the box

| Path | |
| --- | --- |
| `auth/env.ts` | dependency-free `.env` parser and typed settings |
| `auth/errors.ts` | named error types, plus the scraper that quotes the app's own error text |
| `auth/locators.ts` | login-page locators as ordered candidate lists, with fallbacks |
| `auth/login.ts` | **the login routine** — the only file that knows the form |
| `auth/session.ts` | freshness probe, origin warming, state writing |
| `tests/auth.setup.ts` | the setup project body |
| `tests/generated/` | **your recordings go here** |
| `tests/examples/` | one recording, verbatim, as the executable contract |
| `tests/smoke/` | read-only proof the session authenticates |
| `scripts/check-generated-specs.js` | contract lint — wire into your emit step |
| `playwright.config.ts` | the project wiring |

## The contract — what a recorded spec may/must not contain

Recorded specs go in **`tests/generated/<slug>.spec.ts`**. Slug: lowercase
`[a-z0-9-]`, ends `.spec.ts`, must not start with `auth`.

**A recorded spec MAY contain:**

| | |
| --- | --- |
| `import { test, expect } from '@playwright/test';` | the only import it needs |
| a top-level `const data = { ... };` | the extracted values |
| `test('name', async ({ page }) => { ... })` | one or more |
| `await page.goto('https://…')` | absolute URLs |
| `page.getByRole/getByTestId/getByLabel/getByText/getByPlaceholder(...)` + actions | |
| `// Step N: …` and `// ASSERT (enable + edit): …` comments | uncommented asserts work as-is |

**A recorded spec MUST NOT contain** — each of these silently produces an
*unauthenticated* context, i.e. the exact bug this package exists to fix:

| Forbidden | Why it breaks |
| --- | --- |
| `test.use({ storageState: … })` | overrides the project's session; a wrong path or `undefined` yields no session at all |
| `browser.newContext()` / `browser.newPage()` | a hand-made context ignores the project's `storageState` |
| `chromium.launch()` | bypasses the runner, its config, and the session together |
| any mention of `storageState` | the config owns it, exclusively |
| any login step, credential, or navigation to `…/#/login` | already done by the `auth` project |
| its own `playwright.config.ts`, `.env`, or `package.json` | there is one of each, at the root |
| `test.describe.configure({ mode: 'parallel' })` | workers share one session and collide on unique entity names |
| `test.setTimeout(…)` above ~10 min | hangs a generator's run loop on a real failure |
| edits to `auth/**`, `playwright.config.ts`, or `tests/auth.setup.ts` | that is this package's job, not the recording's |
| relative `page.goto('/path')` | works, but couples the recording to our `baseURL` |

After pasting a recording in, run the gate:

```bash
npm run check:specs                              # all of tests/generated/
node scripts/check-generated-specs.js <file>     # one file
```

Exit 0 means clean; exit 1 prints `file:line [rule] why` for each violation.

## Settings

All settings live in `.env` (see `.env.example` for the annotated version). A
real environment variable always beats the file, so `AUTH_MFA_CODE= npm run login`
clears the code for one run.

| Variable | Default | Notes |
| --- | --- | --- |
| `AUTH_EMAIL` | *required* | |
| `AUTH_PASSWORD` | *required* | quote it if it contains spaces or `#` |
| `AUTH_MFA_CODE` | — | appended **directly to the password**. Required on qa/dev. |
| `AUTH_DOMAIN` | — | only if a "Select Domain" step appears |
| `AUTH_LOGIN_URL` | `https://qa.securiti.xyz/#/` | keep the `/#/` |
| `APP_URL` | `https://edc.qa.securiti.xyz/` | also `baseURL` and the probe target |
| `AUTH_WARM_URLS` | `APP_URL` | comma-separated, visited in order after login |
| `AUTH_STATE_MAX_AGE_MINUTES` | `120` | age is necessary but not sufficient; a probe also runs |
| `AUTH_FORCE` | — | `1` = always log in again |
| `AUTH_INCLUDE_INDEXEDDB` | `false` | flip first if login works but specs still hit the wall |
| `HEADLESS` | `false` | |
| `VIEWPORT` | `1920x1080` | **match the window the recording was made in** |
| `WORKERS` | `1` | raising it breaks recorded specs — workers would share one session |
| `AUTH_BROWSER` | `chromium` | login engine only; tests are always chromium |
| `TZ_ID` | `UTC` | not `TZ`, which Node itself reads |
| `TEST_TIMEOUT` / `EXPECT_TIMEOUT` / `ACTION_TIMEOUT` / `NAVIGATION_TIMEOUT` / `LOGIN_TIMEOUT` | 180s / 20s / 30s / 60s / 90s | ms |

## Commands

| | |
| --- | --- |
| `npm run login` | log in (or reuse a valid session) |
| `npm run login:force` | discard the saved session and log in fresh |
| `npm test` | run everything except `examples/` |
| `npm run test:example` | run the verbatim recording — **creates real data** |
| `npm run test:ui` | Playwright UI mode |
| `npm run check:specs` | lint recordings against the contract |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run report` | open the last HTML report |
| `npx playwright test tests/generated/foo.spec.ts` | one recording; `auth` still runs first |

Every setting lives in `.env` — see `.env.example`, which documents each one and its gotcha. A real
environment variable always beats the file, so `AUTH_MFA_CODE= npm run login` clears it for one run.

## Troubleshooting

**A recording fails at its very first click.** Run `npm test`. If the smoke spec passes, auth is fine
and the problem is the locator or the layout. If it fails, run `npm run login:force`.

**It works headed but fails headless.** Almost always the viewport. This app is responsive: below about
1320px it collapses toolbars into overflow menus (and raises a "less than optimal screen size" toast),
at which point `getByRole('button', { name: 'Add' })` genuinely doesn't exist. Set `VIEWPORT` to the
window size the recording was made in.

**`LoginRejectedError`.** The message quotes what the app said. Usually a wrong password or a rotated
`AUTH_MFA_CODE`.

**`DomainRequiredError`.** Your account's email maps to more than one tenant, so a "Select Domain" step
appears. Set `AUTH_DOMAIN` to the label shown in that dropdown.

**Credentials seem to be ignored no matter what you put in `.env`.** A shell `export AUTH_PASSWORD=…`
wins over the file. The setup logs where each value came from — read that line.

**Login and warm-up both look fine, but specs still hit the login wall.** Set
`AUTH_INCLUDE_INDEXEDDB=true` and log in again; the app may keep its token in IndexedDB. If that
doesn't do it, warm the parent app first:
`AUTH_WARM_URLS=https://qa.securiti.xyz/#/,https://edc.qa.securiti.xyz/`.

### Full failure playbook

| Symptom | Cause | Fix |
| --- | --- | --- |
| `LoginRejectedError` quoting the app | bad password, or a wrong/rotated MFA code | fix `.env`; the message carries an MFA hint |
| `LoginRejectedError` at stage `email-step` | the email isn't a known account here | check `AUTH_EMAIL` and `AUTH_LOGIN_URL` |
| `DomainRequiredError` | a "Select Domain" step appeared | set `AUTH_DOMAIN` to the tenant label from that dropdown |
| `LoginTimeoutError` | the form never resolved | read the printed URL + last visible message; run headed |
| `NoSessionCookieError` | left the form but no `FNDRSESSIONID` | an unhandled interstitial — run headed and look |
| `NotAuthenticatedError` at stage `warm` | login worked, `APP_URL` bounced to login | this account lacks access to that module/tenant, or `AUTH_DOMAIN` picked wrong |
| `Missing required setting AUTH_…` | `.env` incomplete | the error prints the exact recipe |
| `ENOENT … .auth/user.json` | `storageState` leaked into top-level `use` | it belongs **only** on the main project; `auth` sets it to `undefined` |
| spec fails at its *first* click | most likely a stale session, second most likely the viewport | `npm test` — if the smoke spec passes, auth is fine and the locator or layout is the problem |
| works headed, fails headless | viewport/layout | set `VIEWPORT` to the recording window; toolbars collapse when narrow |
| `getByRole('button', { name: 'Add' })` not found | compact layout moved it into an overflow menu | widen `VIEWPORT` |
| duplicate-name error on the Create step | the recording reuses a fixed name | change the value in `data`, or emit a unique suffix |
| credentials seem ignored | a shell `export AUTH_PASSWORD=…` beats `.env` | the setup logs the source of each value — read that line |

### Facts about this app that are easy to get wrong

- **Hash routing.** The app is a Vue SPA at `https://qa.securiti.xyz/#/`; login is at `#/login` and
  the app redirects there itself. Keep the `/#/` in `AUTH_LOGIN_URL`.
- **Vuetify.** Errors surface in `.toasted` / `.error--text .v-messages__message`; dropdowns are
  `.v-select`; inputs are `v-model`-bound and can re-render mid-fill.
- **Login is two steps:** email → Continue → *(optional Select Domain)* → password → Sign in. The same
  button element serves both Continue and Sign in — it's bound by `form='fndri-login-form'`.
- **The MFA code is a password suffix**, not a separate field. There is no OTP screen. `password + code`
  goes into the password input, on qa and dev only.
- **Cookies already span subdomains.** `FNDRSESSIONID`, `_xsrf` and `__TID` are set on the wildcard
  domains `.qa.securiti.xyz` and `.securiti.xyz`, so a login at `qa.securiti.xyz` covers
  `edc.qa.securiti.xyz`.
- **localStorage does not.** It is origin-scoped, which is the entire reason `warmOrigins()` exists:
  we visit `APP_URL` before saving so its origin entry is populated.
- **The landing route is account-dependent** — the app has a "Change Homepage" setting. Never assert a
  specific post-login hash.
- **A "less than optimal screen size" toast** appears below ~1320px wide and covers the bottom-right.
  Another reason to keep `VIEWPORT` large.
- **EDC may normally be an iframe.** The parent app exposes it as
  `VUE_APP_DATAHUB_IFRAME_URL: "https://edc.qa.securiti.xyz"`. Driving it top-level works, but if a
  session ever fails to carry, try `AUTH_WARM_URLS=https://qa.securiti.xyz/#/,https://edc.qa.securiti.xyz/`
  and then `AUTH_INCLUDE_INDEXEDDB=true`, in that order.

## Rules when modifying this package

- **Add no npm dependencies.** Three devDeps, deliberately — the `.env` parser in `auth/env.ts` exists
  so that `dotenv` doesn't have to.
- **`auth/login.ts` is the only file that knows the login flow.** Keep it that way.
- **Never hardcode a password or MFA code**, in source, in a test, or in `.env.example`.
- **Never assert `toHaveValue` on a password field** — the failure message prints it into the HTML
  report and the trace. Compare lengths instead, as `login.ts` does.
- **`readRunnerConfig()` must never throw.** It runs at config-load time, where a throw breaks
  `--list`, `--ui`, and `show-report` with a raw stack trace instead of a test failure. Credentials are
  read inside the setup test for exactly this reason.
- **Do not "simplify" the login outcome gate** in `login.ts` to
  `waitForURL(u => !u.href.includes('/login'))`. That predicate resolves immediately when the form
  renders at `#/`, so the session gets saved *before* authentication and every spec then fails at its
  first click with a misleading locator error. The comment there explains it.
- **If you move `.auth/user.json`,** update both `auth/env.ts` and the project `use` in
  `playwright.config.ts`.
- **`tests/examples/glossary-add-term.spec.ts` must keep passing unmodified.** It is a recording
  verbatim, and it is the regression test for this whole contract. Wanting to edit it means the package
  is wrong, not the file.

## Security

`.env` holds a live password. `.auth/` holds a live session — treat it as equivalent to the password.
Both are gitignored, along with `test-results/` and `playwright-report/`, because a failed auth trace
captures the login form and `Set-Cookie` headers. Don't attach traces to tickets without checking them.
Never commit any of the four.

## Adopting a recording into a real test repo

This package is a **harness for validating recordings**, not a test suite. When a recording is going
into an actual repo — with its own page objects, fixtures, and conventions — that's a different job.
See `../adoption-kit/`, which is built to be handed to whoever's doing it.
